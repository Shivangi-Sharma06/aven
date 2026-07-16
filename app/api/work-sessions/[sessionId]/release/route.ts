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
  if (!wallet || !stream || !addressesEqual(wallet, stream.recipient)) {
    return apiError("Only the stream recipient can record this release.", 403);
  }
  if (session.status === "RELEASED") return NextResponse.json(session);
  if (session.status !== "RELEASE_ELIGIBLE") {
    return apiError(`Cannot release funds while the session is ${session.status}.`, 409);
  }

  const body = await request.json().catch(() => ({})) as { txHash?: string };
  const txHash = body.txHash?.trim() ?? "";
  if (!/^[a-f\d]{64}$/i.test(txHash)) return apiError("A valid Stellar transaction hash is required.");
  session.releasedTxHash = txHash;
  addTimelineEvent(
    session,
    "RELEASED",
    "worker",
    `Released ${session.requestedAmount ?? "0.0000000"} through transaction ${txHash}.`,
  );
  await putSession(session);
  return NextResponse.json(session);
}
