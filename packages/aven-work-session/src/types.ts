export type FileChangeSummary = {
  path: string;
  language?: string;
  changeType: "created" | "modified" | "deleted" | "renamed";
  additions?: number;
  deletions?: number;
  category: "source" | "test" | "documentation" | "configuration" | "asset" | "generated" | "dependency" | "unknown";
  includedInVerification: boolean;
  excludedReason?: string;
};

export type CommitSummary = {
  hash: string;
  message: string;
  timestamp: string;
  additions?: number;
  deletions?: number;
};

export type WorkSessionReport = {
  schemaVersion: 1;
  session: {
    sessionId: string;
    projectId: string;
    streamId: string;
    workerAddress: string;
    startedAt: string;
    endedAt: string;
    totalSeconds: number;
    activeSeconds: number;
    idleSeconds: number;
    packageVersion: string;
    projectEnded?: boolean;
  };
  repository: {
    repositoryId: string;
    branchAtStart: string;
    branchAtEnd: string;
    startingCommit?: string;
    endingCommit?: string;
    dirtyAtStart: boolean;
    dirtyAtEnd: boolean;
    // GitHub integration fields (optional, populated by stop --ended)
    githubRepositoryId?: number;
    githubFullName?: string;
    compareUrl?: string;
    baselineVerifiedOnRemote?: boolean;
    endingCommitVerifiedOnRemote?: boolean;
  };
  changes: {
    changedFiles: FileChangeSummary[];
    additions: number;
    deletions: number;
    commits: CommitSummary[];
    testsChanged: number;
    documentationFilesChanged: number;
    generatedFilesExcluded: number;
  };
  workerStatement?: { message: string; providedAt: string };
  localVerification: {
    verifierVersion: string;
    workType: "code" | "writing" | "image" | "mixed";
    flags: string[];
    summary: string;
  };
  paymentRequest: {
    requestedAmount: string;
    asset: "USDC" | "XLM";
    calculation?: "active_time_x_stream_rate" | "remaining_escrow_via_settlement_seconds";
    ratePerSecond?: string;
    billableSeconds?: number;
    settlementSeconds?: string;
  };
  privacy: {
    profile: "standard";
    excludedFileCount: number;
    secretWarnings: number;
    fullFilesIncluded: false;
  };
  // Optional delivery tracking (populated when session ends with --ended)
  delivery?: {
    selectedBranches: Array<{
      name: string;
      headCommit: string;
      verifiedOnRemote: boolean;
    }>;
    includedTags: string[];
    repositoryComplete: boolean;
    verifiedAt?: string;
  };
};

export type AvenConfig = {
  version: 1;
  dashboardUrl: string;
  projectId: string;
  contractId: string;
  streamId: string;
  workerAddress: string;
  asset: "USDC" | "XLM";
  token: string;
  tokenExpiresAt?: string;
  /** Seven-decimal Stellar amount, cached for local recorded-payment estimates. */
  ratePerSecond?: string;
  /** Managed GitHub repository metadata returned by the Aven dashboard. */
  github?: GithubRepoConfig;
};

export type GithubRepoConfig = {
  repositoryId: number;
  fullName: string;
  htmlUrl: string;
  cloneUrl: string;
  sshUrl: string;
};

export type LocalSession = {
  version: 1;
  sessionId: string;
  projectId: string;
  streamId: string;
  workerAddress: string;
  status: "active" | "stopped";
  startedAt: string;
  stoppedAt?: string;
  startingCommit?: string;
  startingBranch: string;
  dirtyAtStart: boolean;
  lastActivityAt: string;
  activeSeconds: number;
  idleSeconds: number;
  activityEvents: number;
  watcherPid?: number;
  /** ISO timestamp refreshed by the activity watcher. */
  watcherHeartbeatAt?: string;
  /**
   * Untracked (not-added) files present at session start.
   * Used by collectChanges to avoid reporting pre-existing untracked
   * files as newly created by the worker.
   */
  startingUntrackedFiles?: string[];
};

// Minimal server-side work session shape used by `aven sessions`.
export type WorkSession = {
  id: string;
  status: string;
  requestedAmount?: string;
  submittedAt?: string;
  updatedAt: string;
  disputeReason?: string;
  workerResponse?: string;
  verificationSummary?: string;
};
