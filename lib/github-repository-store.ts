import "server-only";

import { assertProductionPersistence, dataNamespace, sharedRedis } from "./server-persistence";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RepositoryStatus =
  | "CREATING"
  | "ACTIVE"
  | "TRANSFER_READY"
  | "TRANSFER_PENDING"
  | "TRANSFERRED"
  | "TRANSFER_FAILED";

export type ProjectRepositoryRecord = {
  streamId: string;
  githubRepositoryId: number;
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  cloneUrl: string;
  sshUrl: string;
  defaultBranch?: string;
  visibility: "private";
  workerGithubUserId: number;
  clientGithubUserId: number;
  workerPermission: "push";
  clientPermission: "pull";
  status: RepositoryStatus;
  transferDestination?: string;
  transferredAt?: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
};

// ─── In-memory local fallback ─────────────────────────────────────────────────

const localRecords = new Map<string, ProjectRepositoryRecord>(); // key: streamId
// Secondary index for webhook reconciliation: githubRepositoryId → streamId
const localRepoIdIndex = new Map<number, string>();
const localTransferLocks = new Set<string>();

// ─── Redis key helpers ────────────────────────────────────────────────────────

function repoKey(streamId: string) {
  return `${dataNamespace}:github-repo:${streamId}`;
}

function repoIdIndexKey(githubRepositoryId: number) {
  return `${dataNamespace}:github-repo-id:${githubRepositoryId}`;
}

function transferLockKey(streamId: string) {
  return `${dataNamespace}:github-repo-transfer-lock:${streamId}`;
}

// ─── Exported functions ───────────────────────────────────────────────────────

export async function getRepository(
  streamId: string,
): Promise<ProjectRepositoryRecord | null> {
  assertProductionPersistence();
  if (sharedRedis) {
    return (await sharedRedis.get<ProjectRepositoryRecord>(repoKey(streamId))) ?? null;
  }
  return localRecords.get(streamId) ?? null;
}

export async function putRepository(record: ProjectRepositoryRecord): Promise<void> {
  assertProductionPersistence();
  if (sharedRedis) {
    await Promise.all([
      sharedRedis.set(repoKey(record.streamId), record),
      sharedRedis.set(repoIdIndexKey(record.githubRepositoryId), record.streamId),
    ]);
  } else {
    localRecords.set(record.streamId, record);
    localRepoIdIndex.set(record.githubRepositoryId, record.streamId);
  }
}

/**
 * Find a stream ID by GitHub repository ID.
 * Used by the webhook handler to locate the record after a transfer.
 */
export async function findStreamIdByRepoId(
  githubRepositoryId: number,
): Promise<string | null> {
  assertProductionPersistence();
  if (sharedRedis) {
    return (await sharedRedis.get<string>(repoIdIndexKey(githubRepositoryId))) ?? null;
  }
  return localRepoIdIndex.get(githubRepositoryId) ?? null;
}

export async function acquireRepositoryTransfer(streamId: string): Promise<boolean> {
  assertProductionPersistence();
  if (sharedRedis) {
    return (await sharedRedis.set(transferLockKey(streamId), "locked", { nx: true, ex: 5 * 60 })) !== null;
  }
  if (localTransferLocks.has(streamId)) return false;
  localTransferLocks.add(streamId);
  return true;
}

export async function releaseRepositoryTransfer(streamId: string): Promise<void> {
  assertProductionPersistence();
  if (sharedRedis) {
    await sharedRedis.del(transferLockKey(streamId));
  } else {
    localTransferLocks.delete(streamId);
  }
}
