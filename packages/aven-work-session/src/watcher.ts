import { chmod, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LocalSession } from "./types.js";

export const WATCHER_HEARTBEAT_INTERVAL_MS = 15_000;
export const WATCHER_HEARTBEAT_STALE_MS = 45_000;

export type WatcherSentinel = {
  version: 1;
  pid: number;
  sessionId: string;
  heartbeatAt: string;
};

export function watcherSentinelPath(repositoryRoot: string): string {
  return join(repositoryRoot, ".aven", "watcher.pid");
}

export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function isRecentHeartbeat(
  heartbeatAt: string | undefined,
  now = Date.now(),
): boolean {
  if (!heartbeatAt) return false;
  const parsed = Date.parse(heartbeatAt);
  return Number.isFinite(parsed) &&
    parsed <= now + 5_000 &&
    now - parsed <= WATCHER_HEARTBEAT_STALE_MS;
}

export async function readWatcherSentinel(
  repositoryRoot: string,
): Promise<WatcherSentinel | null> {
  try {
    const parsed = JSON.parse(
      await readFile(watcherSentinelPath(repositoryRoot), "utf8"),
    ) as Partial<WatcherSentinel>;
    if (
      parsed.version !== 1 ||
      !Number.isInteger(parsed.pid) ||
      (parsed.pid ?? 0) <= 0 ||
      typeof parsed.sessionId !== "string" ||
      parsed.sessionId.length === 0 ||
      typeof parsed.heartbeatAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.heartbeatAt))
    ) {
      return null;
    }
    return parsed as WatcherSentinel;
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

export async function writeWatcherSentinel(
  repositoryRoot: string,
  sentinel: WatcherSentinel,
): Promise<void> {
  const path = watcherSentinelPath(repositoryRoot);
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(sentinel)}\n`, { mode: 0o600 });
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
}

export async function removeWatcherSentinel(
  repositoryRoot: string,
  expected: Pick<WatcherSentinel, "pid" | "sessionId">,
): Promise<void> {
  const current = await readWatcherSentinel(repositoryRoot);
  if (
    current &&
    current.pid === expected.pid &&
    current.sessionId === expected.sessionId
  ) {
    await unlink(watcherSentinelPath(repositoryRoot)).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      },
    );
  }
}

export async function isWatcherHealthy(
  repositoryRoot: string,
  session: Pick<
    LocalSession,
    "sessionId" | "watcherPid" | "watcherHeartbeatAt"
  >,
  now = Date.now(),
): Promise<boolean> {
  if (
    !session.watcherPid ||
    !isProcessAlive(session.watcherPid) ||
    !isRecentHeartbeat(session.watcherHeartbeatAt, now)
  ) {
    return false;
  }
  const sentinel = await readWatcherSentinel(repositoryRoot);
  return Boolean(
    sentinel &&
    sentinel.pid === session.watcherPid &&
    sentinel.sessionId === session.sessionId &&
    isRecentHeartbeat(sentinel.heartbeatAt, now),
  );
}
