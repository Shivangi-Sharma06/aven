export type JobState =
  | "received"
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
  createdAt: string;
  updatedAt: string;
};
