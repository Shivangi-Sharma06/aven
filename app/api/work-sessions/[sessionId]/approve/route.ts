import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getSession, putSession } from "@/lib/session-store";
import {
  addTimelineEvent,
  addressesEqual,
  authenticateWalletRequest,
  getSessionOnchainStream,
} from "@/lib/work-session-server";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const session = await getSession(sessionId);
  if (!session) return apiError("Work session was not found.", 404);
  const wallet = authenticateWalletRequest(request);
  const stream = await getSessionOnchainStream(session);
  if (!wallet || !stream || !addressesEqual(wallet, stream.sender)) {
    return apiError("Only the stream sender can approve this request.", 403);
  }
  if (session.status === "APPROVED" || session.status === "RELEASE_ELIGIBLE") {
    return NextResponse.json(session);
  }
  if (session.status !== "PENDING_CLIENT_REVIEW") {
    return apiError(`Cannot approve while the session is ${session.status}.`, 409);
  }
  addTimelineEvent(session, "APPROVED", "client", "Client approved the work session.");
  addTimelineEvent(session, "RELEASE_ELIGIBLE", "system", "The approved amount is release-eligible.");
  await putSession(session);
  return NextResponse.json(session);
}
