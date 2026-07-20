import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeSession } from "../dist/session.js";
import { commandLooksLikeAvenWatcher } from "../dist/stop.js";
import {
  isRecentHeartbeat,
  isWatcherHealthy,
  readWatcherSentinel,
  writeWatcherSentinel,
} from "../dist/watcher.js";

async function withTemporaryRepository(run) {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "aven-watcher-test-"));
  await mkdir(join(repositoryRoot, ".aven"));
  try {
    await run(repositoryRoot);
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
}

async function waitUntil(check, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for watcher state.");
}

test("a current heartbeat and matching ownership identify a healthy watcher", async () => {
  await withTemporaryRepository(async (repositoryRoot) => {
    const heartbeatAt = new Date().toISOString();
    await writeWatcherSentinel(repositoryRoot, {
      version: 1,
      pid: process.pid,
      sessionId: "session-a",
      heartbeatAt,
    });
    assert.equal(
      await isWatcherHealthy(repositoryRoot, {
        sessionId: "session-a",
        watcherPid: process.pid,
        watcherHeartbeatAt: heartbeatAt,
      }),
      true,
    );
  });
});

test("a stale heartbeat never authorizes signalling a matching PID", async () => {
  await withTemporaryRepository(async (repositoryRoot) => {
    const heartbeatAt = new Date(Date.now() - 5 * 60_000).toISOString();
    await writeWatcherSentinel(repositoryRoot, {
      version: 1,
      pid: process.pid,
      sessionId: "session-a",
      heartbeatAt,
    });
    assert.equal(
      await isWatcherHealthy(repositoryRoot, {
        sessionId: "session-a",
        watcherPid: process.pid,
        watcherHeartbeatAt: heartbeatAt,
      }),
      false,
    );
  });
});

test("a sentinel owned by another session is rejected", async () => {
  await withTemporaryRepository(async (repositoryRoot) => {
    const heartbeatAt = new Date().toISOString();
    await writeWatcherSentinel(repositoryRoot, {
      version: 1,
      pid: process.pid,
      sessionId: "other-session",
      heartbeatAt,
    });
    assert.equal(
      await isWatcherHealthy(repositoryRoot, {
        sessionId: "session-a",
        watcherPid: process.pid,
        watcherHeartbeatAt: heartbeatAt,
      }),
      false,
    );
  });
});

test("invalid or missing sentinel data is treated as absent", async () => {
  await withTemporaryRepository(async (repositoryRoot) => {
    assert.equal(await readWatcherSentinel(repositoryRoot), null);
    await writeFile(join(repositoryRoot, ".aven", "watcher.pid"), "not-json");
    assert.equal(await readWatcherSentinel(repositoryRoot), null);
  });
});

test("heartbeat freshness rejects future and stale timestamps", () => {
  const now = Date.now();
  assert.equal(isRecentHeartbeat(new Date(now).toISOString(), now), true);
  assert.equal(
    isRecentHeartbeat(new Date(now - 5 * 60_000).toISOString(), now),
    false,
  );
  assert.equal(
    isRecentHeartbeat(new Date(now + 60_000).toISOString(), now),
    false,
  );
});

test("legacy watcher verification requires both __watch and the repository", () => {
  const repositoryRoot = "/tmp/example-project";
  assert.equal(
    commandLooksLikeAvenWatcher(
      `node /usr/local/lib/aven/dist/cli.js __watch ${repositoryRoot}`,
      repositoryRoot,
    ),
    true,
  );
  assert.equal(
    commandLooksLikeAvenWatcher(
      "node /usr/local/lib/aven/dist/cli.js __watch /tmp/other-project",
      repositoryRoot,
    ),
    false,
  );
  assert.equal(
    commandLooksLikeAvenWatcher(`node server.js ${repositoryRoot}`, repositoryRoot),
    false,
  );
});

test("the watcher handshakes, heartbeats, and removes its sentinel on stop", async () => {
  await withTemporaryRepository(async (repositoryRoot) => {
    const now = new Date().toISOString();
    const session = {
      version: 1,
      sessionId: "integration-session",
      projectId: "integration-1",
      streamId: "1",
      workerAddress: "GWORKER",
      status: "active",
      startedAt: now,
      startingBranch: "dev",
      dirtyAtStart: false,
      lastActivityAt: now,
      activeSeconds: 0,
      idleSeconds: 0,
      activityEvents: 0,
    };
    await writeSession(repositoryRoot, session);
    const child = spawn(
      process.execPath,
      [new URL("../dist/cli.js", import.meta.url).pathname, "__watch", repositoryRoot],
      { stdio: "ignore" },
    );
    assert.ok(child.pid);
    session.watcherPid = child.pid;
    await writeSession(repositoryRoot, session);

    await waitUntil(async () => {
      const sentinel = await readWatcherSentinel(repositoryRoot);
      return sentinel?.pid === child.pid &&
        sentinel.sessionId === session.sessionId &&
        isRecentHeartbeat(sentinel.heartbeatAt);
    });

    child.kill("SIGTERM");
    await new Promise((resolve, reject) => {
      child.once("exit", resolve);
      child.once("error", reject);
    });
    assert.equal(await readWatcherSentinel(repositoryRoot), null);
  });
});
