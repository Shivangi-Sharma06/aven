import "server-only";

import { readJsonFile, resolveDataPath, writeJsonFileAtomic } from "./json-file-store";
import { assertProductionPersistence, dataNamespace, sharedRedis } from "./server-persistence";
import type { WorkSession } from "./work-session";

type SessionFile = {
  version: 1;
  sessions: WorkSession[];
};

const redisKey = `${dataNamespace}:work-sessions`;
const storePath = resolveDataPath(process.env.AVEN_SESSION_STORE, "./data/work-sessions.json");
let sessions: Map<string, WorkSession> | undefined;
let writeQueue: Promise<void> = Promise.resolve();

async function hydrateLocal() {
  if (sessions) return sessions;
  const file = await readJsonFile<SessionFile>(storePath, { version: 1, sessions: [] });
  sessions = new Map(file.sessions.map((session) => [session.id, session]));
  return sessions;
}

async function persistLocal() {
  const map = await hydrateLocal();
  const file: SessionFile = { version: 1, sessions: [...map.values()] };
  writeQueue = writeQueue.then(() => writeJsonFileAtomic(storePath, file));
  await writeQueue;
}

async function listAllSessions(): Promise<WorkSession[]> {
  assertProductionPersistence();
  if (sharedRedis) {
    return ((await sharedRedis.hvals(redisKey)) ?? []) as WorkSession[];
  }
  return [...(await hydrateLocal()).values()];
}

export async function getSession(id: string) {
  assertProductionPersistence();
  if (sharedRedis) {
    return (await sharedRedis.hget<WorkSession>(redisKey, id)) ?? null;
  }
  return (await hydrateLocal()).get(id) ?? null;
}

export async function putSession(session: WorkSession) {
  assertProductionPersistence();
  if (sharedRedis) {
    await sharedRedis.hset(redisKey, { [session.id]: session });
  } else {
    (await hydrateLocal()).set(session.id, session);
    await persistLocal();
  }
  return session;
}

export async function listSessionsForStream(streamId: string) {
  return (await listAllSessions())
    .filter((session) => session.streamId === streamId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listPendingReviewForClient(clientAddress: string) {
  const normalized = clientAddress.toLowerCase();
  return (await listAllSessions())
    .filter(
      (session) =>
        session.clientAddress.toLowerCase() === normalized &&
        session.status === "PENDING_CLIENT_REVIEW",
    )
    .sort((a, b) => a.reviewDeadlineAt?.localeCompare(b.reviewDeadlineAt ?? "") ?? 0);
}
