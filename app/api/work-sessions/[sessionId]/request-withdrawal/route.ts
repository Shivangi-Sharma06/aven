import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getSession, listSessionsForStream, putSession } from "@/lib/session-store";
import {
  addTimelineEvent,
  addressesEqual,
  authenticateCliRequest,
  authenticateWalletRequest,
  getEarnedUnits,
  getOnchainStream,
  parseAmountUnits,
} from "@/lib/work-session-server";

const RESERVED_STATES = new Set([
  "WITHDRAWAL_REQUESTED",
  "PENDING_CLIENT_REVIEW",
  "APPROVED",
  "DISPUTED",
  "RESPONSE_SUBMITTED",
  "RELEASE_ELIGIBLE",
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
  const wallet = token?.walletAddress ?? authenticateWalletRequest(request);
  if (!wallet || !addressesEqual(wallet, session.workerAddress)) {
    return apiError("Only the stream recipient can request this withdrawal.", 403);
  }
  if (RESERVED_STATES.has(session.status)) return NextResponse.json(session);
  if (session.status !== "VERIFICATION_COMPLETE") {
    return apiError(`Cannot request withdrawal while the session is ${session.status}.`, 409);
  }
  const stream = await getOnchainStream(session.streamId);
  if (!stream || !addressesEqual(stream.recipient, wallet)) {
    return apiError("The stream recipient could not be verified.", 403);
  }
  try {
    const requestedAmount = session.report?.paymentRequest.requestedAmount;
    if (!requestedAmount) return apiError("The report has no payment request.");
    const requestedUnits = parseAmountUnits(requestedAmount);
    const earnedUnits = await getEarnedUnits(session.streamId);
    const otherSessions = await listSessionsForStream(session.streamId);
    const reservedUnits = otherSessions
      .filter((other) => other.id !== session.id && RESERVED_STATES.has(other.status))
      .reduce((total, other) => total + parseAmountUnits(other.requestedAmount ?? "0"), 0n);
    if (requestedUnits <= 0n || requestedUnits > earnedUnits - reservedUnits) {
      return apiError("The requested amount exceeds the stream earnings not already reserved.", 409);
    }
    session.requestedAmount = requestedAmount;
    addTimelineEvent(session, "WITHDRAWAL_REQUESTED", "worker", `Requested ${requestedAmount} ${stream.asset}.`);
    session.reviewDeadlineAt = new Date(
      Date.now() + Math.max(stream.approvalTimeoutLedgers, 1) * 5_000,
    ).toISOString();
    addTimelineEvent(session, "PENDING_CLIENT_REVIEW", "system", "Client review window opened.");
    await putSession(session);
    return NextResponse.json(session);
  } catch (error) {
    return apiError(error);
  }
}
