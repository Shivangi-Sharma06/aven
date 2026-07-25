import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getSession, putSession } from "@/lib/session-store";
import {
  addTimelineEvent,
  addressesEqual,
  authenticateCliRequest,
  authenticateBrowserSession,
  calculateSettlementSeconds,
  formatAmountUnits,
  getAvailableUnits,
  getSessionOnchainStream,
  parseAmountUnits,
} from "@/lib/work-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESERVED_STATES = new Set([
  "WITHDRAWAL_REQUESTED",
  "PENDING_CLIENT_REVIEW",
  "APPROVED",
  "DISPUTED",
  "RESPONSE_SUBMITTED",
  "RELEASE_ELIGIBLE",
  "RELEASING",
  "RELEASED",
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const session = await getSession(sessionId);
  if (!session) return apiError("Work session was not found.", 404);
  const token = await authenticateCliRequest(request, "request_withdrawal");
  const wallet = token?.walletAddress ?? await authenticateBrowserSession(request);
  if (!wallet || !addressesEqual(wallet, session.workerAddress)) {
    return apiError("Only the stream recipient can request this withdrawal.", 403);
  }
  if (RESERVED_STATES.has(session.status)) return NextResponse.json(session);
  if (session.status !== "VERIFICATION_COMPLETE") {
    return apiError(`Cannot request withdrawal while the session is ${session.status}.`, 409);
  }
  const stream = await getSessionOnchainStream(session);
  if (!stream || !addressesEqual(stream.recipient, wallet)) {
    return apiError("The stream recipient could not be verified.", 403);
  }
  try {
    const projectEnded = session.report?.session.projectEnded === true;
    const requestedAmount = session.report?.paymentRequest.requestedAmount;
    if (!requestedAmount) return apiError("The report has no payment request.");
    const availableUnits = await getAvailableUnits(session.streamId);
    const remainingEscrowUnits =
      stream.totalDepositedUnits - stream.totalWithdrawnUnits;
    if (projectEnded && availableUnits !== remainingEscrowUnits) {
      return apiError(
        "Resolve every pending or reserved work-session payment before requesting the final settlement.",
        409,
      );
    }
    const requestedUnits = projectEnded
      ? availableUnits
      : parseAmountUnits(requestedAmount);
    if (requestedUnits <= 0n || requestedUnits > availableUnits) {
      return apiError("The requested amount exceeds the stream earnings not already reserved.", 409);
    }
    if (!session.report) return apiError("The verified report is missing.", 409);
    const settlementSeconds = projectEnded
      ? calculateSettlementSeconds(stream, availableUnits)
      : undefined;
    if (projectEnded) {
      session.report.paymentRequest = {
        ...session.report.paymentRequest,
        requestedAmount: formatAmountUnits(requestedUnits),
        calculation: "remaining_escrow_via_settlement_seconds",
        billableSeconds: session.report.session.activeSeconds,
        settlementSeconds: settlementSeconds?.toString(),
      };
    }
    // The on-chain request_withdrawal (legacy, no verifier) must have been called from
    // the frontend by the recipient before hitting this endpoint. Accept the txHash.
    const body = await request.json().catch(() => ({})) as { txHash?: string };
    const { txHash } = body;
    if (!txHash || !/^[a-f\d]{64}$/i.test(txHash)) {
      return apiError("A valid on-chain transaction hash from requestWithdrawalLegacy is required. Call requestWithdrawalLegacy from the frontend first.", 400);
    }
    session.requestedAmount = formatAmountUnits(requestedUnits);
    session.verifierTxHash = txHash;
    // Fetch the on-chain withdrawal record to get the deadline_ledger.
    // Use the anonymous address for read-only simulation.
    let reviewDeadlineLedger: number;
    try {
      const { getStreamClient } = await import("@/lib/contracts");
      const anonAddr = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
      const client = getStreamClient(anonAddr);
      const withdrawalRecord = await client.get_withdrawal({
        stream_id: BigInt(session.streamId),
        request_id: session.id,
      });
      const claim = ((withdrawalRecord.result as any)?.unwrap?.() ?? withdrawalRecord.result) as any;
      reviewDeadlineLedger = Number(claim?.deadline_ledger ?? 0);
    } catch {
      // If we can't read the on-chain record, estimate from the stream's timeout.
      const { getOnchainStream } = await import("@/lib/work-session-server");
      const fallbackStream = await getOnchainStream(session.streamId);
      reviewDeadlineLedger = fallbackStream?.approvalTimeoutLedgers ?? 50;
    }
    session.reviewDeadlineLedger = reviewDeadlineLedger;
    addTimelineEvent(
      session,
      "WITHDRAWAL_REQUESTED",
      "worker",
      projectEnded
        ? `Reserved the final ${session.requestedAmount} ${stream.asset} settlement using ${settlementSeconds} contract-equivalent seconds.`
        : `Reserved ${session.requestedAmount} ${stream.asset} against the verified session.`,
    );
    session.reviewDeadlineAt = new Date(
      Date.now() + Math.max(stream.approvalTimeoutLedgers, 1) * 5_000,
    ).toISOString();
    addTimelineEvent(
      session,
      "PENDING_CLIENT_REVIEW",
      "system",
      projectEnded
        ? "Final project settlement submitted for client review. The legacy contract timeout remains active."
        : "Client review window opened.",
    );
    await putSession(session);
    return NextResponse.json(session);
  } catch (error) {
    return apiError(error);
  }
}
