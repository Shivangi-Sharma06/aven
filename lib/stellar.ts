/**
 * lib/stellar.ts — Real on-chain interactions via Freighter + Soroban contract bindings.
 * i128 amounts use 7 decimals (10_000_000 = 1 unit).
 */

import {
  getAddress,
  isConnected as freighterIsConnected,
  requestAccess,
} from "@stellar/freighter-api";
import { Buffer } from "buffer";

import {
  getStreamClient,
  getAttestationClient,
  getReputationClient,
  fromContractAmount,
  toContractAmount,
  USDC_ASSET_ID,
  XLM_ASSET_ID,
  STREAM_CONTRACT_ID,
  ATTESTATION_CONTRACT_ID,
  REPUTATION_CONTRACT_ID,
} from "./contracts";

export {
  STREAM_CONTRACT_ID,
  ATTESTATION_CONTRACT_ID,
  REPUTATION_CONTRACT_ID,
  USDC_ASSET_ID,
  XLM_ASSET_ID,
} from "./contracts";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StreamStatus = "active" | "paused" | "completed" | "cancelled";
export type StreamCategory =
  | "Freelance"
  | "Salary"
  | "Bounty"
  | "Grant"
  | "AgentTask"
  | "Subscription";
export type StreamAsset = "USDC" | "XLM";

export type StreamObject = {
  id: string;
  sender: string;
  recipient: string;
  ratePerLedger: number;
  asset: StreamAsset;
  totalDeposited: number;
  totalWithdrawn: number;
  startLedger: number;
  durationLedgers: number;
  status: StreamStatus;
  category: StreamCategory;
  title: string;
  pausedAtLedger?: number;
  pausedDurationLedgers: number;
  checkpointCount: number;
  checkpointSpanLedgers: number;
  withdrawableCapPercent: number;
  approvalTimeoutLedgers: number;
};

export type AttestationObject = {
  id: string;
  streamId: string;
  recipient: string;
  sender: string;
  checkpointIndex: number;
  category: StreamCategory;
  title: string;
  amountPaid: number;
  asset: StreamAsset;
  periodStartLedger: number;
  periodEndLedger: number;
  mintedAtLedger: number;
  clientConfirmed: boolean;
};

export type CheckpointObject = {
  streamId: string;
  index: number;
  dueLedger: number;
  submitted: boolean;
  approved: boolean;
  autoApproved: boolean;
  attestationId: string | null;
  evidenceHash: string;
};

export type ScoreBreakdown = {
  total: number;
  freelance: number;
  salary: number;
  bounty: number;
  grant: number;
  agentTask: number;
  subscription: number;
};

export type CreateStreamInput = {
  recipient: string;
  totalAmount: number;
  asset: StreamAsset;
  durationLedgers: number;
  ratePerSecond: number;
  checkpointCount: number;
  withdrawableCapPercent: number;
  approvalTimeoutLedgers: number;
  category: StreamCategory;
  title: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assetIdFor(asset: StreamAsset): string {
  return asset === "USDC" ? USDC_ASSET_ID : XLM_ASSET_ID;
}

function assetFromId(contractId: string): StreamAsset {
  return contractId === USDC_ASSET_ID ? "USDC" : "XLM";
}

function statusFromTag(tag: string): StreamStatus {
  const map: Record<string, StreamStatus> = {
    Active: "active",
    Paused: "paused",
    Completed: "completed",
    Cancelled: "cancelled",
  };
  return map[tag] ?? "active";
}

function categoryFromTag(tag: string): StreamCategory {
  return tag as StreamCategory;
}

function toBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  return BigInt(String(v));
}

function bufferFromHex(value: string): Buffer {
  const normalized = value.trim().replace(/^0x/i, "");
  if (normalized.length % 2 !== 0) {
    throw new Error("Evidence hash must be an even-length hex string");
  }
  return Buffer.from(normalized, "hex");
}

/** SHA-256 hash of UTF-8 text, returned as 64-char hex (for checkpoint evidence). */
export async function hashEvidenceText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const ANON_ADDR = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

// ─── Wallet ───────────────────────────────────────────────────────────────────

export async function checkFreighterInstalled(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await freighterIsConnected();
    if (typeof res === "boolean") return res;
    return (res as { isConnected: boolean }).isConnected;
  } catch {
    return false;
  }
}

/** Restore an existing Freighter session without prompting the user. */
export async function restoreWallet(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const installed = await checkFreighterInstalled();
    if (!installed) return null;
    const res = await getAddress();
    const address = typeof res === "string" ? res : (res as { address: string }).address;
    return address || null;
  } catch {
    return null;
  }
}

export async function connectWallet(): Promise<{ address: string; connected: boolean }> {
  await requestAccess();
  const res = await getAddress();
  const address = typeof res === "string" ? res : (res as { address: string }).address;
  return { address, connected: true };
}

export async function disconnectWallet(): Promise<void> {
  // Freighter doesn't expose revoke; caller clears local state
}

// ─── Stream contract ──────────────────────────────────────────────────────────

export async function createStream(
  data: CreateStreamInput,
  callerAddress: string
): Promise<{ streamId: string; txHash: string }> {
  const client = getStreamClient(callerAddress);
  const ratePerSecond = toContractAmount(data.ratePerSecond);
  const totalDeposited = toContractAmount(data.totalAmount);

  const tx = await client.create_stream({
    sender: callerAddress,
    recipient: data.recipient,
    rate_per_second: ratePerSecond,
    asset: assetIdFor(data.asset),
    total_deposited: totalDeposited,
    duration_ledgers: data.durationLedgers,
    checkpoint_count: data.checkpointCount,
    withdrawable_cap_percent: data.withdrawableCapPercent,
    approval_timeout_ledgers: data.approvalTimeoutLedgers,
    category: { tag: data.category, values: undefined as any },
    title: data.title,
  });

  const sent = await tx.signAndSend();
  const raw = (sent as any).result?.unwrap?.() ?? (sent as any).result ?? 0n;
  return { streamId: String(raw), txHash: (sent as any).hash ?? "" };
}

export async function pauseStream(streamId: string, callerAddress: string): Promise<void> {
  const client = getStreamClient(callerAddress);
  const tx = await client.pause_stream({ stream_id: BigInt(streamId), caller: callerAddress });
  await tx.signAndSend();
}

export async function submitCheckpoint(
  streamId: string,
  workerAddress: string,
  index: number,
  evidenceHashHex: string
): Promise<void> {
  const client = getStreamClient(workerAddress);
  const tx = await client.submit_checkpoint({
    stream_id: BigInt(streamId),
    worker: workerAddress,
    index,
    evidence_hash: bufferFromHex(evidenceHashHex),
  });
  await tx.signAndSend();
}

export async function approveCheckpoint(
  streamId: string,
  senderAddress: string,
  index: number
): Promise<string> {
  const client = getStreamClient(senderAddress);
  const tx = await client.approve_checkpoint({
    stream_id: BigInt(streamId),
    sender: senderAddress,
    index,
  });
  const sent = await tx.signAndSend();
  const raw = (sent as any).result?.unwrap?.() ?? (sent as any).result ?? 0n;
  return String(raw);
}

export async function settleCheckpoints(streamId: string, callerAddress: string): Promise<number> {
  const client = getStreamClient(callerAddress);
  const tx = await client.settle_checkpoints({ stream_id: BigInt(streamId) });
  const sent = await tx.signAndSend();
  const raw = (sent as any).result?.unwrap?.() ?? (sent as any).result ?? 0n;
  return Number(raw);
}

export async function getCheckpoint(
  streamId: string,
  index: number,
  callerAddress?: string
): Promise<CheckpointObject | null> {
  const addr = callerAddress ?? ANON_ADDR;
  const client = getStreamClient(addr);
  try {
    const tx = await client.get_checkpoint({ stream_id: BigInt(streamId), index });
    const record = (tx.result as any)?.unwrap?.() ?? tx.result;
    if (!record) return null;
    return mapCheckpointRecord(record);
  } catch {
    return null;
  }
}

export async function resumeStream(streamId: string, callerAddress: string): Promise<void> {
  const client = getStreamClient(callerAddress);
  const tx = await client.resume_stream({ stream_id: BigInt(streamId), caller: callerAddress });
  await tx.signAndSend();
}

export async function cancelStream(streamId: string, callerAddress: string): Promise<void> {
  const client = getStreamClient(callerAddress);
  const tx = await client.cancel_stream({ stream_id: BigInt(streamId), caller: callerAddress });
  await tx.signAndSend();
}

export async function withdrawEarned(
  streamId: string,
  callerAddress: string
): Promise<{ amount: number; txHash: string }> {
  const client = getStreamClient(callerAddress);
  const tx = await client.withdraw({ stream_id: BigInt(streamId), caller: callerAddress });
  const sent = await tx.signAndSend();
  const raw = (sent as any).result?.unwrap?.() ?? 0n;
  return {
    amount: fromContractAmount(toBigInt(raw)),
    txHash: (sent as any).hash ?? "",
  };
}

export async function getStream(streamId: string, callerAddress?: string): Promise<StreamObject | null> {
  const addr = callerAddress ?? ANON_ADDR;
  const client = getStreamClient(addr);
  try {
    const tx = await client.get_stream({ stream_id: BigInt(streamId) });
    const record = (tx.result as any)?.unwrap?.() ?? tx.result;
    if (!record) return null;
    return mapStreamRecord(record);
  } catch {
    return null;
  }
}

export async function computeEarned(streamId: string, callerAddress?: string): Promise<number> {
  const addr = callerAddress ?? ANON_ADDR;
  const client = getStreamClient(addr);
  try {
    const tx = await client.compute_earned({ stream_id: BigInt(streamId) });
    const raw = (tx.result as any)?.unwrap?.() ?? tx.result ?? 0n;
    return fromContractAmount(toBigInt(raw));
  } catch {
    return 0;
  }
}

export async function getSenderStreams(address: string): Promise<StreamObject[]> {
  const client = getStreamClient(address);
  try {
    const tx = await client.get_sender_streams({ sender: address });
    const ids: bigint[] = (tx.result as any) ?? [];
    const results = await Promise.all(ids.map((id) => getStream(String(id), address)));
    return results.filter(Boolean) as StreamObject[];
  } catch {
    return [];
  }
}

export async function getRecipientStreams(address: string): Promise<StreamObject[]> {
  const client = getStreamClient(address);
  try {
    const tx = await client.get_recipient_streams({ recipient: address });
    const ids: bigint[] = (tx.result as any) ?? [];
    const results = await Promise.all(ids.map((id) => getStream(String(id), address)));
    return results.filter(Boolean) as StreamObject[];
  } catch {
    return [];
  }
}

function mapStreamRecord(r: any): StreamObject {
  return {
    id: String(r.id),
    sender: r.sender,
    recipient: r.recipient,
    ratePerLedger: fromContractAmount(toBigInt(r.rate_per_ledger)),
    asset: assetFromId(r.asset),
    totalDeposited: fromContractAmount(toBigInt(r.total_deposited)),
    totalWithdrawn: fromContractAmount(toBigInt(r.total_withdrawn)),
    startLedger: Number(r.start_ledger),
    durationLedgers: Number(r.duration_ledgers),
    status: statusFromTag(r.status?.tag ?? "Active"),
    category: categoryFromTag(r.category?.tag ?? "Freelance"),
    title: r.title,
    pausedAtLedger: r.paused_at_ledger ? Number(r.paused_at_ledger) : undefined,
    pausedDurationLedgers: Number(r.paused_duration_ledgers ?? 0),
    checkpointCount: Number(r.checkpoint_count ?? 0),
    checkpointSpanLedgers: Number(r.checkpoint_span_ledgers ?? 0),
    withdrawableCapPercent: Number(r.withdrawable_cap_percent ?? 0),
    approvalTimeoutLedgers: Number(r.approval_timeout_ledgers ?? 0),
  };
}

function mapCheckpointRecord(r: any): CheckpointObject {
  return {
    streamId: String(r.stream_id),
    index: Number(r.index),
    dueLedger: Number(r.due_ledger),
    submitted: Boolean(r.submitted),
    approved: Boolean(r.approved),
    autoApproved: Boolean(r.auto_approved),
    attestationId: r.attestation_id ? String(r.attestation_id) : null,
    evidenceHash: Buffer.from(r.evidence_hash ?? []).toString("hex"),
  };
}

// ─── Attestation contract ─────────────────────────────────────────────────────

export async function getAttestation(attestationId: string, callerAddress?: string): Promise<AttestationObject | null> {
  const addr = callerAddress ?? ANON_ADDR;
  const client = getAttestationClient(addr);
  try {
    const tx = await client.get_attestation({ attestation_id: BigInt(attestationId) });
    const r = (tx.result as any)?.unwrap?.() ?? tx.result;
    if (!r) return null;
    return mapAttestationRecord(r);
  } catch {
    return null;
  }
}

export async function verifyAttestation(attestationId: string, callerAddress?: string): Promise<boolean> {
  const addr = callerAddress ?? ANON_ADDR;
  const client = getAttestationClient(addr);
  try {
    const tx = await client.verify_attestation({ attestation_id: BigInt(attestationId) });
    return Boolean(tx.result);
  } catch {
    return false;
  }
}

export async function getWorkerAttestations(address: string): Promise<AttestationObject[]> {
  const client = getAttestationClient(address);
  try {
    const tx = await client.get_recipient_attestations({ recipient: address });
    const ids: bigint[] = (tx.result as any) ?? [];
    const results = await Promise.all(ids.map((id) => getAttestation(String(id), address)));
    return results.filter(Boolean) as AttestationObject[];
  } catch {
    return [];
  }
}

function mapAttestationRecord(r: any): AttestationObject {
  return {
    id: String(r.id),
    streamId: String(r.stream_id),
    recipient: r.recipient,
    sender: r.sender,
    checkpointIndex: Number(r.checkpoint_index),
    category: categoryFromTag(r.category?.tag ?? "Freelance"),
    title: r.title,
    amountPaid: fromContractAmount(toBigInt(r.amount_paid)),
    asset: assetFromId(r.asset),
    periodStartLedger: Number(r.period_start_ledger),
    periodEndLedger: Number(r.period_end_ledger),
    mintedAtLedger: Number(r.minted_at_ledger),
    clientConfirmed: Boolean(r.client_confirmed),
  };
}

// ─── Contract initialization helpers ─────────────────────────────────────────

export async function initStreamContract(admin: string, attestationContract: string): Promise<void> {
  const client = getStreamClient(admin);
  const tx = await client.init({ admin, attestation_contract: attestationContract });
  await tx.signAndSend();
}

export async function initAttestationContract(admin: string, streamContract: string): Promise<void> {
  const client = getAttestationClient(admin);
  const tx = await client.init({ admin, stream_contract: streamContract });
  await tx.signAndSend();
}

// ─── Reputation contract ──────────────────────────────────────────────────────

export async function computeScore(address: string): Promise<ScoreBreakdown> {
  const client = getReputationClient(address);
  try {
    const tx = await client.get_score_breakdown({
      attestation_contract: ATTESTATION_CONTRACT_ID,
      recipient: address,
    });
    const r: any = tx.result;
    return {
      total: fromContractAmount(toBigInt(r?.total ?? 0n)),
      freelance: fromContractAmount(toBigInt(r?.freelance ?? 0n)),
      salary: fromContractAmount(toBigInt(r?.salary ?? 0n)),
      bounty: fromContractAmount(toBigInt(r?.bounty ?? 0n)),
      grant: fromContractAmount(toBigInt(r?.grant ?? 0n)),
      agentTask: fromContractAmount(toBigInt(r?.agent_task ?? 0n)),
      subscription: fromContractAmount(toBigInt(r?.subscription ?? 0n)),
    };
  } catch {
    return { total: 0, freelance: 0, salary: 0, bounty: 0, grant: 0, agentTask: 0, subscription: 0 };
  }
}

export async function computeTotalScore(address: string): Promise<number> {
  const client = getReputationClient(address);
  try {
    const tx = await client.compute_score({
      attestation_contract: ATTESTATION_CONTRACT_ID,
      recipient: address,
    });
    return fromContractAmount(toBigInt(tx.result ?? 0n));
  } catch {
    return 0;
  }
}

export async function verifyClaim(address: string, minimumScore: number): Promise<boolean> {
  const client = getReputationClient(address);
  try {
    const tx = await client.verify_claim({
      attestation_contract: ATTESTATION_CONTRACT_ID,
      recipient: address,
      minimum_score: toContractAmount(minimumScore),
    });
    return Boolean(tx.result);
  } catch {
    return false;
  }
}
