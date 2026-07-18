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
  };
  repository: {
    repositoryId: string;
    branchAtStart: string;
    branchAtEnd: string;
    startingCommit?: string;
    endingCommit?: string;
    dirtyAtStart: boolean;
    dirtyAtEnd: boolean;
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
    calculation?: "active_time_x_stream_rate";
    ratePerSecond?: string;
    billableSeconds?: number;
  };
  privacy: {
    profile: "standard";
    excludedFileCount: number;
    secretWarnings: number;
    fullFilesIncluded: false;
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
};

export type LocalSession = {
  version: 1;
  sessionId: string;
  projectId: string;
  streamId: string;
  workerAddress: string;
  status: "active" | "stopped";
  startedAt: string;
  startingCommit?: string;
  startingBranch: string;
  dirtyAtStart: boolean;
  lastActivityAt: string;
  activeSeconds: number;
  idleSeconds: number;
  activityEvents: number;
  watcherPid?: number;
};
