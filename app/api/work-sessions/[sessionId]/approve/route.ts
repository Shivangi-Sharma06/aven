import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getSession, putSession } from "@/lib/session-store";
import {
  addTimelineEvent,
  addressesEqual,
  authenticateBrowserSession,
  getSessionOnchainStream,
} from "@/lib/work-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const session = await getSession(sessionId);
  if (!session) return apiError("Work session was not found.", 404);
  const wallet = await authenticateBrowserSession(request);
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
  const projectEnded = session.report?.session.projectEnded === true;
  addTimelineEvent(
    session,
    "APPROVED",
    "client",
    projectEnded
      ? "Client explicitly approved final project completion."
      : "Client approved the work session.",
  );
  addTimelineEvent(
    session,
    "RELEASE_ELIGIBLE",
    "system",
    projectEnded
      ? "The final project settlement is release-eligible."
      : "The approved amount is release-eligible.",
  );
  await putSession(session);
  return NextResponse.json(session);
}
