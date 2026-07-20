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
import { recordVerifiedWork } from "@/lib/work-stream-verifier";

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
    const onchain = await recordVerifiedWork({
      streamId: session.streamId,
      sessionId: session.id,
      amountUnits: requestedUnits,
      report: session.report,
      onchainActiveSeconds: settlementSeconds,
    });
    session.requestedAmount = formatAmountUnits(requestedUnits);
    session.verifierTxHash = onchain.transactionHash ?? session.verifierTxHash;
    session.reportDigest = onchain.reportDigest;
    session.reviewDeadlineLedger = onchain.reviewDeadlineLedger;
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
