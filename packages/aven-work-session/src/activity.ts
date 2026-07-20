import chokidar from "chokidar";
import { relativeRepositoryPath } from "./git.js";
import { createPrivacyFilter } from "./privacy.js";
import { readSession, writeSession } from "./session.js";
import {
  removeWatcherSentinel,
  WATCHER_HEARTBEAT_INTERVAL_MS,
  writeWatcherSentinel,
} from "./watcher.js";

const IDLE_AFTER_SECONDS = 10 * 60;

async function waitForOwnedSession(repositoryRoot: string) {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const session = await readSession(repositoryRoot);
    if (
      session &&
      session.status === "active" &&
      session.watcherPid === process.pid
    ) {
      return session;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return null;
}

export async function runActivityWatcher(repositoryRoot: string) {
  const excluded = await createPrivacyFilter(repositoryRoot);
  let queue = Promise.resolve();
  const watcher = chokidar.watch(repositoryRoot, {
    ignoreInitial: true,
    persistent: true,
    ignored: (path) => {
      const relative = relativeRepositoryPath(repositoryRoot, path);
      return Boolean(relative && excluded(relative));
    },
  });

  const initialSession = await waitForOwnedSession(repositoryRoot);
  if (
    !initialSession ||
    initialSession.status !== "active" ||
    initialSession.watcherPid !== process.pid
  ) {
    await watcher.close();
    throw new Error("Watcher session ownership could not be verified.");
  }
  const sessionId = initialSession.sessionId;

  const heartbeat = async () => {
    const heartbeatAt = new Date().toISOString();
    const session = await readSession(repositoryRoot);
    if (
      !session ||
      session.status !== "active" ||
      session.sessionId !== sessionId ||
      session.watcherPid !== process.pid
    ) {
      throw new Error("Watcher no longer owns the active session.");
    }
    session.watcherHeartbeatAt = heartbeatAt;
    await writeSession(repositoryRoot, session);
    await writeWatcherSentinel(repositoryRoot, {
      version: 1,
      pid: process.pid,
      sessionId,
      heartbeatAt,
    });
  };

  try {
    await heartbeat();
  } catch (error) {
    await watcher.close();
    await removeWatcherSentinel(repositoryRoot, {
      pid: process.pid,
      sessionId,
    }).catch(() => undefined);
    throw error;
  }

  watcher.on("all", () => {
    queue = queue.then(async () => {
      const session = await readSession(repositoryRoot);
      if (
        !session ||
        session.status !== "active" ||
        session.sessionId !== sessionId
      ) {
        return;
      }
      const now = new Date();
      const elapsed = Math.max(
        0,
        Math.floor(
          (now.getTime() - Date.parse(session.lastActivityAt)) / 1000,
        ),
      );
      session.activeSeconds += Math.min(elapsed, IDLE_AFTER_SECONDS);
      session.idleSeconds += Math.max(0, elapsed - IDLE_AFTER_SECONDS);
      session.lastActivityAt = now.toISOString();
      session.activityEvents += 1;
      await writeSession(repositoryRoot, session);
    }).catch(() => undefined);
  });

  const heartbeatTimer = setInterval(() => {
    queue = queue.then(heartbeat).catch(() => undefined);
  }, WATCHER_HEARTBEAT_INTERVAL_MS);

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(heartbeatTimer);
    try {
      await queue;
      await watcher.close();
      await removeWatcherSentinel(repositoryRoot, {
        pid: process.pid,
        sessionId,
      });
    } finally {
      process.exit(0);
    }
  };
  process.once("SIGTERM", () => void stop());
  process.once("SIGINT", () => void stop());
  await new Promise(() => undefined);
}
