import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getSession, putSession } from "@/lib/session-store";
import {
  addTimelineEvent,
  addressesEqual,
  authenticateCliRequest,
  authenticateWalletRequest,
} from "@/lib/work-session-server";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const session = await getSession(sessionId);
  if (!session) return apiError("Work session was not found.", 404);
  const token = await authenticateCliRequest(request, "request_withdrawal");
  const wallet = token?.walletAddress ?? authenticateWalletRequest(request);
  if (!wallet || !addressesEqual(wallet, session.workerAddress)) {
    return apiError("Only the worker can respond to this dispute.", 403);
  }
  if (session.status === "RESPONSE_SUBMITTED") return NextResponse.json(session);
  if (session.status !== "DISPUTED") {
    return apiError(`Cannot respond while the session is ${session.status}.`, 409);
  }
  const body = (await request.json()) as { response?: string };
  const response = body.response?.trim() ?? "";
  if (response.length < 20) return apiError("A response of at least 20 characters is required.");
  session.workerResponse = response;
  addTimelineEvent(session, "RESPONSE_SUBMITTED", "worker", response);
  await putSession(session);
  return NextResponse.json(session);
}
