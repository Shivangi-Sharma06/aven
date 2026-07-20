import { createHash } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import { getBrowserSession } from "./browser-session-store";
import { getCliToken, type CliScope } from "./cli-auth-store";
import { getStreamClient, STREAM_CONTRACT_ID, USDC_ASSET_ID } from "./contracts";
import type { WorkSession, WorkSessionEvent, WorkSessionReport } from "./work-session";

const ANONYMOUS_ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const AMOUNT_PATTERN = /^(0|[1-9]\d*)(?:\.(\d{1,7}))?$/;
const SIGN_MESSAGE_PREFIX = "Stellar Signed Message:\n";
const SECONDS_PER_LEDGER = 5n;

export type OnchainStream = {
  id: string;
  sender: string;
  recipient: string;
  asset: "USDC" | "XLM";
  status: "active" | "paused" | "completed" | "cancelled";
  approvalTimeoutLedgers: number;
  ratePerLedgerUnits: bigint;
  totalDepositedUnits: bigint;
  totalWithdrawnUnits: bigint;
};

function unwrapResult<T>(value: unknown): T {
  return ((value as { unwrap?: () => T })?.unwrap?.() ?? value) as T;
}

export async function getOnchainStream(streamId: string): Promise<OnchainStream | null> {
  if (!/^\d+$/.test(streamId)) return null;
  const client = getStreamClient(ANONYMOUS_ADDRESS);
  try {
    const transaction = await client.get_stream({ stream_id: BigInt(streamId) });
    const record = unwrapResult<any>(transaction.result);
    if (!record) return null;
    const status = String(record.status?.tag ?? "Active").toLowerCase();
    return {
      id: String(record.id),
      sender: String(record.sender),
      recipient: String(record.recipient),
      asset: record.asset === USDC_ASSET_ID ? "USDC" : "XLM",
      status: status as OnchainStream["status"],
      approvalTimeoutLedgers: Number(record.approval_timeout_ledgers),
      ratePerLedgerUnits: BigInt(String(record.rate_per_ledger)),
      totalDepositedUnits: BigInt(String(record.total_deposited)),
      totalWithdrawnUnits: BigInt(String(record.total_withdrawn)),
    };
  } catch (err: any) {
    console.error("Error fetching stream:", err);
    return null;
  }
}

export async function getEarnedUnits(streamId: string): Promise<bigint> {
  const client = getStreamClient(ANONYMOUS_ADDRESS);
  const transaction = await client.compute_earned({ stream_id: BigInt(streamId) });
  return BigInt(String(unwrapResult<bigint>(transaction.result) ?? 0n));
}

export async function getAvailableUnits(streamId: string): Promise<bigint> {
  const client = getStreamClient(ANONYMOUS_ADDRESS);
  const transaction = await client.compute_available({ stream_id: BigInt(streamId) });
  return BigInt(String(unwrapResult<bigint>(transaction.result) ?? 0n));
}

export function parseAmountUnits(value: string): bigint {
  const match = AMOUNT_PATTERN.exec(value);
  if (!match) throw new Error("Amount must be a non-negative decimal string with at most 7 decimal places.");
  return BigInt(match[1]) * 10_000_000n + BigInt((match[2] ?? "").padEnd(7, "0"));
}

export function formatAmountUnits(value: bigint): string {
  const whole = value / 10_000_000n;
  const fractional = (value % 10_000_000n).toString().padStart(7, "0");
  return `${whole}.${fractional}`;
}

export function ratePerSecondUnits(stream: OnchainStream) {
  return stream.ratePerLedgerUnits / SECONDS_PER_LEDGER;
}

export function calculateSessionPaymentUnits(
  stream: OnchainStream,
  activeSeconds: number,
  availableUnits: bigint,
) {
  if (!Number.isSafeInteger(activeSeconds) || activeSeconds < 0) {
    throw new Error("Active session time must be a non-negative whole number of seconds.");
  }
  const sessionUnits = ratePerSecondUnits(stream) * BigInt(activeSeconds);
  return sessionUnits < availableUnits ? sessionUnits : availableUnits;
}

export function addressesEqual(left: string, right: string) {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

export function roleForWallet(stream: OnchainStream, walletAddress: string) {
  if (addressesEqual(stream.sender, walletAddress)) return "client" as const;
  if (addressesEqual(stream.recipient, walletAddress)) return "worker" as const;
  return "unrelated" as const;
}

export function sessionMatchesOnchainStream(session: WorkSession, stream: OnchainStream) {
  const contractMatches =
    !session.contractId || addressesEqual(session.contractId, STREAM_CONTRACT_ID);
  return (
    contractMatches &&
    session.streamId === stream.id &&
    addressesEqual(session.workerAddress, stream.recipient) &&
    addressesEqual(session.clientAddress, stream.sender)
  );
}

export async function getSessionOnchainStream(session: WorkSession) {
  const stream = await getOnchainStream(session.streamId);
  return stream && sessionMatchesOnchainStream(session, stream) ? stream : null;
}

export function verifyWalletSignature(
  walletAddress: string,
  message: string,
  signature: string,
) {
  try {
    const signatureBytes = /^[a-f\d]{128}$/i.test(signature)
      ? Buffer.from(signature, "hex")
      : Buffer.from(signature, "base64");
    const messageHash = createHash("sha256")
      .update(`${SIGN_MESSAGE_PREFIX}${message}`, "utf8")
      .digest();
    return Keypair.fromPublicKey(walletAddress).verify(messageHash, signatureBytes);
  } catch {
    return false;
  }
}

export async function authenticateCliRequest(request: Request, scope: CliScope) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+([a-f\d]{64})$/i.exec(authorization);
  if (!match) return null;
  const token = await getCliToken(match[1]);
  if (!token || !token.scopes.includes(scope)) return null;
  return token;
}

/**
 * Authenticate a browser (dashboard) request via the aven_session HttpOnly
 * cookie.  Returns the wallet address stored in Redis, or null if the session
 * is missing or expired.
 *
 * The old multiline-header approach (x-aven-wallet / x-aven-message /
 * x-aven-signature) was removed because HTTP headers cannot contain newline
 * characters, causing browsers to reject the request before it reached the
 * API handler.
 */
export async function authenticateBrowserSession(
  request: Request,
): Promise<string | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = /(?:^|;\s*)aven_session=([^;]+)/.exec(cookieHeader);
  const sessionId = match?.[1];
  if (!sessionId) return null;
  return getBrowserSession(sessionId);
}

export function addTimelineEvent(
  session: WorkSession,
  status: WorkSession["status"],
  actor: WorkSessionEvent["actor"],
  note?: string,
) {
  const at = new Date().toISOString();
  session.status = status;
  session.updatedAt = at;
  session.timeline = [...(session.timeline ?? []), { status, at, actor, note }];
  return session;
}

export function validateWorkSessionReport(value: unknown): asserts value is WorkSessionReport {
  if (!value || typeof value !== "object") throw new Error("A work-session report is required.");
  const report = value as Partial<WorkSessionReport>;
  if (report.schemaVersion !== 1) throw new Error("schemaVersion must be 1.");
  if (!report.session || !report.repository || !report.changes || !report.paymentRequest || !report.privacy) {
    throw new Error("The work-session report is incomplete.");
  }
  if (!report.session.sessionId?.trim() || !report.session.streamId?.trim()) {
    throw new Error("Session and stream identifiers are required.");
  }
  if (!report.session.workerAddress?.trim()) throw new Error("workerAddress is required.");
  if (Date.parse(report.session.startedAt) >= Date.parse(report.session.endedAt)) {
    throw new Error("Session start time must be before its end time.");
  }
  if (
    !Number.isFinite(report.session.totalSeconds) ||
    !Number.isFinite(report.session.activeSeconds) ||
    !Number.isFinite(report.session.idleSeconds) ||
    report.session.totalSeconds < 0 ||
    report.session.activeSeconds < 0 ||
    report.session.idleSeconds < 0
  ) {
    throw new Error("Session durations must be non-negative numbers.");
  }
  if (
    !Number.isSafeInteger(report.session.activeSeconds) ||
    !Number.isSafeInteger(report.session.totalSeconds) ||
    report.session.activeSeconds > report.session.totalSeconds
  ) {
    throw new Error("Active session time must be a whole number no greater than total session time.");
  }
  if (
    report.session.projectEnded !== undefined &&
    typeof report.session.projectEnded !== "boolean"
  ) {
    throw new Error("projectEnded must be a boolean when provided.");
  }
  if (!Array.isArray(report.changes.changedFiles) || !Array.isArray(report.changes.commits)) {
    throw new Error("Changed files and commits must be arrays.");
  }
  if (report.changes.changedFiles.length > 5_000) throw new Error("The report contains too many files.");
  parseAmountUnits(report.paymentRequest.requestedAmount);
  if (report.paymentRequest.asset !== "USDC" && report.paymentRequest.asset !== "XLM") {
    throw new Error("Unsupported payment asset.");
  }
  if (report.privacy.fullFilesIncluded !== false) {
    throw new Error("Full file contents are not accepted by this endpoint.");
  }
}
