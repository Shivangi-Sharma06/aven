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
    return apiError("Only the stream recipient can cancel this release attempt.", 403);
  }
  if (session.status !== "RELEASING") return NextResponse.json(session);
  addTimelineEvent(session, "RELEASE_ELIGIBLE", "worker", "Stellar release was cancelled before submission.");
  await putSession(session);
  return NextResponse.json(session);
}
