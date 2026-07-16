import type { MandateConfig, StreamParams } from "../../../contracts/bindings/agent_mandate/src/index.ts";

export function validateLocally(config: MandateConfig, params: StreamParams, currentLedger: number) {
  if (config.revoked) throw new Error("Mandate is permanently revoked.");
  if (config.paused) throw new Error("Mandate is paused.");
  if (currentLedger >= config.policy.expires_at_ledger) throw new Error("Mandate has expired.");
  if (params.total_deposited <= 0n || params.rate_per_second <= 0n) {
    throw new Error("Amounts must be positive.");
  }
  if (params.total_deposited > config.policy.per_stream_limit) {
    throw new Error("Payment exceeds the mandate per-stream limit.");
  }
  if (params.duration_ledgers > config.policy.max_duration_ledgers) {
    throw new Error("Duration exceeds the mandate policy.");
  }
  if (params.checkpoint_count > config.policy.max_checkpoint_count) {
    throw new Error("Checkpoint count exceeds the mandate policy.");
  }
}

export function needsOwnerApproval(config: MandateConfig, amount: bigint) {
  return amount >= config.policy.human_approval_threshold;
}
