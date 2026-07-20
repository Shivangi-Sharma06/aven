/**
 * Shared data contracts for Aven work-session tracking, verification, review,
 * and payment release.
 */

export type SessionStatus =
  | "LOCAL_ACTIVE"
  | "LOCAL_STOPPED"
  | "SUBMITTED"
  | "VERIFYING"
  | "VERIFICATION_COMPLETE"
  | "WITHDRAWAL_REQUESTED"
  | "PENDING_CLIENT_REVIEW"
  | "APPROVED"
  | "DISPUTED"
  | "RESPONSE_SUBMITTED"
  | "RELEASE_ELIGIBLE"
  | "RELEASING"
  | "RELEASED"
  | "FAILED";

export type FileChangeSummary = {
  path: string;
  language?: string;
  changeType: "created" | "modified" | "deleted" | "renamed";
  additions?: number;
  deletions?: number;
  category:
    | "source"
    | "test"
    | "documentation"
    | "configuration"
    | "asset"
    | "generated"
    | "dependency"
    | "unknown";
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
  workerStatement?: {
    message: string;
    providedAt: string;
  };
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
};

export type WorkSessionEvent = {
  status: SessionStatus;
  at: string;
  actor: "worker" | "client" | "system";
  note?: string;
};

export type WorkSession = {
  id: string;
  contractId?: string;
  streamId: string;
  workerAddress: string;
  clientAddress: string;
  status: SessionStatus;
  report?: WorkSessionReport;
  verificationSummary?: string;
  verificationFlags?: string[];
  requestedAmount?: string;
  reviewDeadlineAt?: string;
  reviewDeadlineLedger?: number;
  verifierTxHash?: string;
  reportDigest?: string;
  disputeReason?: string;
  workerResponse?: string;
  releasedTxHash?: string;
  submittedAt?: string;
  timeline?: WorkSessionEvent[];
  createdAt: string;
  updatedAt: string;
};
