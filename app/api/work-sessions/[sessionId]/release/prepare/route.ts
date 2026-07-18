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
  if (!wallet || !stream || !addressesEqual(wallet, stream.recipient)) {
    return apiError("Only the stream recipient can prepare this release.", 403);
  }
  if (session.status === "RELEASED") return NextResponse.json(session);
  if (session.status === "RELEASING") {
    return apiError("This release is already being submitted. Do not send another transaction.", 409);
  }
  if (session.status !== "RELEASE_ELIGIBLE") {
    return apiError(`Cannot prepare a release while the session is ${session.status}.`, 409);
  }
  addTimelineEvent(session, "RELEASING", "worker", "Stellar release transaction is being submitted.");
  await putSession(session);
  return NextResponse.json(session);
}
