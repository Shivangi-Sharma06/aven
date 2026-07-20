import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LocalSession } from "./types.js";

export function sessionPath(repositoryRoot: string) {
  return join(repositoryRoot, ".aven", "session.json");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

export function isLocalSession(value: unknown): value is LocalSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<LocalSession>;
  return session.version === 1 &&
    isNonEmptyString(session.sessionId) &&
    isNonEmptyString(session.projectId) &&
    typeof session.streamId === "string" &&
    /^\d+$/.test(session.streamId) &&
    isNonEmptyString(session.workerAddress) &&
    (session.status === "active" || session.status === "stopped") &&
    isIsoTimestamp(session.startedAt) &&
    (session.stoppedAt === undefined || isIsoTimestamp(session.stoppedAt)) &&
    (session.startingCommit === undefined || isNonEmptyString(session.startingCommit)) &&
    isNonEmptyString(session.startingBranch) &&
    typeof session.dirtyAtStart === "boolean" &&
    isIsoTimestamp(session.lastActivityAt) &&
    isNonNegativeInteger(session.activeSeconds) &&
    isNonNegativeInteger(session.idleSeconds) &&
    isNonNegativeInteger(session.activityEvents) &&
    (
      session.watcherPid === undefined ||
      (Number.isInteger(session.watcherPid) && session.watcherPid > 0)
    ) &&
    (
      session.watcherHeartbeatAt === undefined ||
      isIsoTimestamp(session.watcherHeartbeatAt)
    );
}

export async function readSession(repositoryRoot: string): Promise<LocalSession | null> {
  try {
    const raw = await readFile(sessionPath(repositoryRoot), "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Corrupt session file — treat as absent.
      return null;
    }
    return isLocalSession(parsed) ? parsed : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function writeSession(repositoryRoot: string, session: LocalSession) {
  const directory = join(repositoryRoot, ".aven");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = sessionPath(repositoryRoot);
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, path);
}

export async function deleteSession(repositoryRoot: string) {
  await unlink(sessionPath(repositoryRoot)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}
