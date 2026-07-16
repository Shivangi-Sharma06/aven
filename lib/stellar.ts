/**
 * lib/stellar.ts — Real on-chain interactions via Freighter + Soroban contract bindings.
 * i128 amounts use 7 decimals (10_000_000 = 1 unit).
 */

import {
  getAddress,
  getNetwork,
  isConnected as freighterIsConnected,
  requestAccess,
} from "@stellar/freighter-api";

import {
  getStreamClient,
  getAttestationClient,
  getReputationClient,
  fromContractAmount,
  toContractAmount,
  USDC_ASSET_ID,
  XLM_ASSET_ID,
  NETWORK_PASSPHRASE,
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

export const STRICT_REVIEWED_WITHDRAWALS =
  process.env.NEXT_PUBLIC_STRICT_REVIEWED_WITHDRAWALS === "true";

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
  hasAttestation: boolean;
  attestationId?: string;
  pausedAtLedger?: number;
};

export type AttestationObject = {
  id: string;
  streamId: string;
  recipient: string;
  sender: string;
  category: StreamCategory;
  title: string;
  totalPaid: number;
  asset: StreamAsset;
  startLedger: number;
  endLedger: number;
  mintedAtLedger: number;
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
  category: StreamCategory;
  title: string;
  checkpointCount?: number;
  withdrawableCapPercent?: number;
  approvalTimeoutLedgers?: number;
};

const DEFAULT_CHECKPOINT_COUNT = 4;
const DEFAULT_WITHDRAWABLE_CAP_PERCENT = 60;
const DEFAULT_APPROVAL_TIMEOUT_LEDGERS = 50;

function checkpointCountFor(durationLedgers: number, requested?: number): number {
  if (requested !== undefined) return requested;

  for (let count = DEFAULT_CHECKPOINT_COUNT; count > 1; count -= 1) {
    if (durationLedgers % count === 0) return count;
  }

  return 1;
}

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

function decimalAmountToContract(value: string): bigint {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,7}))?$/.exec(value);
  if (!match) throw new Error("Invalid Stellar amount.");
  return BigInt(match[1]) * 10_000_000n + BigInt((match[2] ?? "").padEnd(7, "0"));
}

const ANON_ADDR = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

// ─── Wallet ───────────────────────────────────────────────────────────────────

export async function checkFreighterInstalled(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await freighterIsConnected();
    if (res.error) return false;
    return Boolean(res.isConnected);
  } catch {
    return false;
  }
}

export async function connectWallet(): Promise<{ address: string; connected: boolean }> {
  const access = await requestAccess();
  if (access.error) throw new Error(access.error.message);

  const addressResult = access.address ? access : await getAddress();
  if (addressResult.error) throw new Error(addressResult.error.message);
  const address = addressResult.address;
  if (!address) throw new Error("Freighter did not return an account address.");

  const network = await getNetwork();
  if (network.error) throw new Error(network.error.message);
  if (network.networkPassphrase !== NETWORK_PASSPHRASE) {
    throw new Error("Switch Freighter to Stellar Testnet, then try connecting again.");
  }
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
    checkpoint_count: checkpointCountFor(data.durationLedgers, data.checkpointCount),
    withdrawable_cap_percent:
      data.withdrawableCapPercent ?? DEFAULT_WITHDRAWABLE_CAP_PERCENT,
    approval_timeout_ledgers:
      data.approvalTimeoutLedgers ?? DEFAULT_APPROVAL_TIMEOUT_LEDGERS,
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

export async function requestReviewedWithdrawal(
  streamId: string,
  recipientAddress: string,
  requestId: string,
  amount: string,
): Promise<void> {
  const client = getStreamClient(recipientAddress);
  const tx = await client.request_withdrawal({
    stream_id: BigInt(streamId),
    recipient: recipientAddress,
    request_id: requestId,
    amount: decimalAmountToContract(amount),
  });
  await tx.signAndSend();
}

export async function approveReviewedWithdrawal(
  streamId: string,
  senderAddress: string,
  requestId: string,
): Promise<void> {
  const client = getStreamClient(senderAddress);
  const tx = await client.approve_withdrawal({
    stream_id: BigInt(streamId),
    sender: senderAddress,
    request_id: requestId,
  });
  await tx.signAndSend();
}

export async function disputeReviewedWithdrawal(
  streamId: string,
  senderAddress: string,
  requestId: string,
): Promise<void> {
  const client = getStreamClient(senderAddress);
  const tx = await client.dispute_withdrawal({
    stream_id: BigInt(streamId),
    sender: senderAddress,
    request_id: requestId,
  });
  await tx.signAndSend();
}

export async function withdrawReviewed(
  streamId: string,
  recipientAddress: string,
  requestId: string,
): Promise<{ amount: number; txHash: string }> {
  const client = getStreamClient(recipientAddress);
  const tx = await client.withdraw_approved({
    stream_id: BigInt(streamId),
    recipient: recipientAddress,
    request_id: requestId,
  });
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
    hasAttestation: Boolean(r.has_attestation),
    attestationId: r.has_attestation ? String(r.attestation_id) : undefined,
    pausedAtLedger: r.paused_at_ledger ? Number(r.paused_at_ledger) : undefined,
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
    category: categoryFromTag(r.category?.tag ?? "Freelance"),
    title: r.title,
    totalPaid: fromContractAmount(toBigInt(r.total_paid)),
    asset: assetFromId(r.asset),
    startLedger: Number(r.start_ledger),
    endLedger: Number(r.end_ledger),
    mintedAtLedger: Number(r.minted_at_ledger),
  };
}

// ─── Reputation contract ──────────────────────────────────────────────────────

export async function computeScore(address: string): Promise<ScoreBreakdown> {
  const client = getReputationClient(address);
  const attestationContractId = getAttestationClient(address).options.contractId;
  try {
    const tx = await client.get_score_breakdown({
      attestation_contract: attestationContractId,
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

export async function verifyClaim(address: string, minimumScore: number): Promise<boolean> {
  const client = getReputationClient(address);
  const attestationContractId = getAttestationClient(address).options.contractId;
  try {
    const tx = await client.verify_claim({
      attestation_contract: attestationContractId,
      recipient: address,
      minimum_score: toContractAmount(minimumScore),
    });
    return Boolean(tx.result);
  } catch {
    return false;
  }
}
