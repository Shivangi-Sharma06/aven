import { readJsonFile, resolveDataPath, writeJsonFileAtomic } from "./json-file-store";
import type { WorkSession } from "./work-session";

type SessionFile = {
  version: 1;
  sessions: WorkSession[];
};

const storePath = resolveDataPath(process.env.AVEN_SESSION_STORE, "./data/work-sessions.json");
let sessions: Map<string, WorkSession> | undefined;
let writeQueue: Promise<void> = Promise.resolve();

async function hydrate() {
  if (sessions) return sessions;
  const file = await readJsonFile<SessionFile>(storePath, { version: 1, sessions: [] });
  sessions = new Map(file.sessions.map((session) => [session.id, session]));
  return sessions;
}

async function persist() {
  const map = await hydrate();
  const file: SessionFile = { version: 1, sessions: [...map.values()] };
  writeQueue = writeQueue.then(() => writeJsonFileAtomic(storePath, file));
  await writeQueue;
}

export async function getSession(id: string) {
  return (await hydrate()).get(id) ?? null;
}

export async function putSession(session: WorkSession) {
  (await hydrate()).set(session.id, session);
  await persist();
  return session;
}

export async function listSessionsForStream(streamId: string) {
  return [...(await hydrate()).values()]
    .filter((session) => session.streamId === streamId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listPendingReviewForClient(clientAddress: string) {
  const normalized = clientAddress.toLowerCase();
  return [...(await hydrate()).values()]
    .filter(
      (session) =>
        session.clientAddress.toLowerCase() === normalized &&
        session.status === "PENDING_CLIENT_REVIEW",
    )
    .sort((a, b) => a.reviewDeadlineAt?.localeCompare(b.reviewDeadlineAt ?? "") ?? 0);
}
