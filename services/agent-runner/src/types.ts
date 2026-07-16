export type JobState =
  | "received"
  | "verifying"
  | "submitting"
  | "executed"
  | "pending_owner"
  | "already_processed"
  | "failed";

export type StreamJob = {
  jobId: string;
  recipient: string;
  asset: string;
  totalAmount: string;
  ratePerSecond: string;
  durationLedgers: number;
  checkpointCount: number;
  withdrawableCapPercent: number;
  approvalTimeoutLedgers: number;
  title: string;
  workType: "code" | "creative";
  artifactUrl: string;
  baselineUrl?: string;
};

export type JobRecord = {
  mandateAddress: string;
  requestId: string;
  job: StreamJob;
  state: JobState;
  attempts: number;
  proposalId?: string;
  streamId?: string;
  transactionHash?: string;
  failureReason?: string;
  workType?: "code" | "creative";
  verificationScore?: number;
  verificationSummary?: string;
  evidenceHash?: string;
  verificationFlags?: string[];
  createdAt: string;
  updatedAt: string;
};
