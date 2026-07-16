import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getSession, putSession } from "@/lib/session-store";
import {
  addTimelineEvent,
  addressesEqual,
  authenticateWalletRequest,
  getOnchainStream,
} from "@/lib/work-session-server";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const session = await getSession(sessionId);
  if (!session) return apiError("Work session was not found.", 404);
  const wallet = authenticateWalletRequest(request);
  const stream = await getOnchainStream(session.streamId);
  if (!wallet || !stream || !addressesEqual(wallet, stream.sender)) {
    return apiError("Only the stream sender can dispute this request.", 403);
  }
  if (session.status === "DISPUTED" || session.status === "RESPONSE_SUBMITTED") {
    return NextResponse.json(session);
  }
  if (session.status !== "PENDING_CLIENT_REVIEW") {
    return apiError(`Cannot dispute while the session is ${session.status}.`, 409);
  }
  const body = (await request.json()) as { reason?: string };
  const reason = body.reason?.trim() ?? "";
  if (reason.length < 20) return apiError("A dispute explanation of at least 20 characters is required.");
  session.disputeReason = reason;
  addTimelineEvent(session, "DISPUTED", "client", reason);
  await putSession(session);
  return NextResponse.json(session);
}
