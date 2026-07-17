/**
 * lib/stellar.ts — Real on-chain interactions via Freighter + Soroban contract bindings.
 * i128 amounts use 7 decimals (10_000_000 = 1 unit).
 */

import {
  getAddress,
  getNetwork,
  isConnected as freighterIsConnected,
  isAllowed as freighterIsAllowed,
  requestAccess,
  WatchWalletChanges,
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
  ATTESTATION_CONTRACT_ID,
  STREAM_CONTRACT_ID,
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
  hasAttestation: boolean;
  attestationId?: string;
  pausedAtLedger?: number;
  pausedDurationLedgers: number;
  checkpointCount: number;
  checkpointSpanLedgers: number;
  withdrawableCapPercent: number;
  approvalTimeoutLedgers: number;
};

export type CheckpointObject = {
  streamId: string;
  index: number;
  dueLedger: number;
  submitted: boolean;
  evidenceHash: string;
  approved: boolean;
  autoApproved: boolean;
  attestationId: string;
};

export type AttestationObject = {
  id: string;
  streamId: string;
  recipient: string;
  sender: string;
  category: StreamCategory;
  title: string;
  amountPaid: number;
  asset: StreamAsset;
  startLedger: number;
  endLedger: number;
  mintedAtLedger: number;
  kind: string;
  clientConfirmed: boolean;
  autoReleased: boolean;
  requestId: string;
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

const DEFAULT_APPROVAL_TIMEOUT_LEDGERS = 50;
const DEFAULT_WITHDRAWABLE_CAP_PERCENT = 65;

function checkpointCountFor(durationLedgers: number, requested?: number): number {
  if (requested !== undefined) return requested;
  for (let count = 4; count > 1; count -= 1) {
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

function transactionHash(sent: any): string {
  const value =
    sent?.sendTransactionResponse?.hash ??
    sent?.getTransactionResponse?.txHash ??
    sent?.hash;
  if (typeof value === "string" && /^[a-f\d]{64}$/i.test(value)) return value.toLowerCase();
  if (value instanceof Uint8Array && value.byteLength === 32) {
    return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  throw new Error("Stellar confirmed the transaction but did not return a valid transaction hash.");
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

export async function getConnectedWallet(): Promise<{ address: string; connected: boolean } | null> {
  if (typeof window === "undefined") return null;
  const installed = await checkFreighterInstalled();
  if (!installed) return null;

  const allowed = await freighterIsAllowed();
  if (allowed.error || !allowed.isAllowed) return null;

  const addressResult = await getAddress();
  if (addressResult.error || !addressResult.address) return null;

  const network = await getNetwork();
  if (network.error || network.networkPassphrase !== NETWORK_PASSPHRASE) return null;
  return { address: addressResult.address, connected: true };
}

export function watchWalletChanges(
  onChange: (next: { address: string; networkPassphrase: string }) => void,
) {
  const watcher = new WatchWalletChanges(1500);
  const result = watcher.watch((params) => {
    if (!params.error && params.address) {
      onChange({ address: params.address, networkPassphrase: params.networkPassphrase });
    }
  });
  if (result.error) return () => undefined;
  return () => watcher.stop();
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
    withdrawable_cap_percent: data.withdrawableCapPercent ?? DEFAULT_WITHDRAWABLE_CAP_PERCENT,
    approval_timeout_ledgers:
      data.approvalTimeoutLedgers ?? DEFAULT_APPROVAL_TIMEOUT_LEDGERS,
    category: { tag: data.category, values: undefined as any },
    title: data.title,
  });

  const sent = await tx.signAndSend();
  const raw = (sent as any).result?.unwrap?.() ?? (sent as any).result ?? 0n;
  return { streamId: String(raw), txHash: transactionHash(sent) };
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

export async function approveReviewedWithdrawal(
  streamId: string,
  senderAddress: string,
  requestId: string,
): Promise<void> {
  const client = getStreamClient(senderAddress);
  const existing = await client.get_withdrawal({
    stream_id: BigInt(streamId),
    request_id: requestId,
  });
  const claim = (existing.result as any)?.unwrap?.() ?? existing.result;
  if (claim?.status?.tag === "Approved") return;
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
  const existing = await client.get_withdrawal({
    stream_id: BigInt(streamId),
    request_id: requestId,
  });
  const claim = (existing.result as any)?.unwrap?.() ?? existing.result;
  if (claim?.status?.tag === "Disputed") return;
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
    txHash: transactionHash(sent),
  };
}

function hexToBytes32(value: string): Uint8Array {
  const normalized = value.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error("Evidence hash must be a 32-byte hex string.");
  }
  return Uint8Array.from(normalized.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)));
}

export async function hashEvidence(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function submitCheckpoint(
  streamId: string,
  workerAddress: string,
  index: number,
  evidenceHashHex: string,
): Promise<void> {
  const client = getStreamClient(workerAddress);
  const tx = await client.submit_checkpoint({
    stream_id: BigInt(streamId),
    worker: workerAddress,
    index,
    evidence_hash: hexToBytes32(evidenceHashHex) as any,
  });
  await tx.signAndSend();
}

export async function approveCheckpoint(
  streamId: string,
  senderAddress: string,
  index: number,
): Promise<void> {
  const client = getStreamClient(senderAddress);
  const tx = await client.approve_checkpoint({
    stream_id: BigInt(streamId),
    sender: senderAddress,
    index,
  });
  await tx.signAndSend();
}

export async function settleCheckpoints(streamId: string, callerAddress: string): Promise<number> {
  const client = getStreamClient(callerAddress);
  const tx = await client.settle_checkpoints({ stream_id: BigInt(streamId) });
  const sent = await tx.signAndSend();
  const raw = (sent as any).result?.unwrap?.() ?? (sent as any).result ?? 0n;
  return Number(toBigInt(raw));
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

export async function computeAvailable(streamId: string, callerAddress?: string): Promise<number> {
  const addr = callerAddress ?? ANON_ADDR;
  const client = getStreamClient(addr);
  try {
    const tx = await client.compute_available({ stream_id: BigInt(streamId) });
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
    hasAttestation: false,
    pausedAtLedger: r.paused_at_ledger ? Number(r.paused_at_ledger) : undefined,
    pausedDurationLedgers: Number(r.paused_duration_ledgers ?? 0),
    checkpointCount: Number(r.checkpoint_count ?? 1),
    checkpointSpanLedgers: Number(r.checkpoint_span_ledgers ?? r.duration_ledgers ?? 0),
    withdrawableCapPercent: Number(r.withdrawable_cap_percent ?? DEFAULT_WITHDRAWABLE_CAP_PERCENT),
    approvalTimeoutLedgers: Number(r.approval_timeout_ledgers ?? DEFAULT_APPROVAL_TIMEOUT_LEDGERS),
  };
}

export function streamContractExplorerUrl() {
  if (!STREAM_CONTRACT_ID) return "https://stellar.expert/explorer/testnet";
  return `https://stellar.expert/explorer/testnet/contract/${STREAM_CONTRACT_ID}`;
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
    amountPaid: fromContractAmount(toBigInt(r.amount_paid)),
    asset: assetFromId(r.asset),
    startLedger: Number(r.period_start_ledger),
    endLedger: Number(r.period_end_ledger),
    mintedAtLedger: Number(r.minted_at_ledger),
    kind: r.kind?.tag ?? "Checkpoint",
    clientConfirmed: Boolean(r.client_confirmed),
    autoReleased: Boolean(r.auto_released),
    requestId: r.request_id ?? "",
  };
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
      total: Number(toBigInt(r?.total ?? 0n)),
      freelance: Number(toBigInt(r?.freelance ?? 0n)),
      salary: Number(toBigInt(r?.salary ?? 0n)),
      bounty: Number(toBigInt(r?.bounty ?? 0n)),
      grant: Number(toBigInt(r?.grant ?? 0n)),
      agentTask: Number(toBigInt(r?.agent_task ?? 0n)),
      subscription: Number(toBigInt(r?.subscription ?? 0n)),
    };
  } catch {
    return { total: 0, freelance: 0, salary: 0, bounty: 0, grant: 0, agentTask: 0, subscription: 0 };
  }
}

export async function verifyClaim(address: string, minimumScore: number): Promise<boolean> {
  const client = getReputationClient(address);
  try {
    const tx = await client.verify_claim({
      attestation_contract: ATTESTATION_CONTRACT_ID,
      recipient: address,
      minimum_score: BigInt(Math.round(minimumScore)),
    });
    return Boolean(tx.result);
  } catch {
    return false;
  }
}

export async function getCheckpoint(
  streamId: string,
  index: number,
  callerAddress?: string
): Promise<CheckpointObject | null> {
  const addr = callerAddress ?? ANON_ADDR;
  const client = getStreamClient(addr);
  try {
    const tx = await client.get_checkpoint({
      stream_id: BigInt(streamId),
      index,
    });
    const r = (tx.result as any)?.unwrap?.() ?? tx.result;
    if (!r) return null;
    return {
      streamId: String(r.stream_id),
      index: Number(r.index),
      dueLedger: Number(r.due_ledger),
      submitted: Boolean(r.submitted),
      evidenceHash: r.evidence_hash
        ? Array.from(new Uint8Array(r.evidence_hash), (byte) => byte.toString(16).padStart(2, "0")).join("")
        : "",
      approved: Boolean(r.approved),
      autoApproved: Boolean(r.auto_approved),
      attestationId: String(r.attestation_id),
    };
  } catch {
    return null;
  }
}

export async function getLatestLedger(): Promise<number> {
  try {
    const response = await fetch("https://soroban-testnet.stellar.org", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getLatestLedger",
      }),
    });
    const data = await response.json();
    return Number(data.result.sequence);
  } catch {
    return 0;
  }
}
