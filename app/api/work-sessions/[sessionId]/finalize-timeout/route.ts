import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getSession, putSession } from "@/lib/session-store";
import { addTimelineEvent } from "@/lib/work-session-server";

export async function POST(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const session = await getSession(sessionId);
  if (!session) return apiError("Work session was not found.", 404);
  if (session.status === "RELEASE_ELIGIBLE" || session.status === "RELEASED") {
    return NextResponse.json(session);
  }
  if (session.status !== "PENDING_CLIENT_REVIEW") {
    return apiError(`Cannot finalize timeout while the session is ${session.status}.`, 409);
  }
  if (!session.reviewDeadlineAt || Date.parse(session.reviewDeadlineAt) > Date.now()) {
    return apiError("The client review window has not expired.", 409);
  }
  addTimelineEvent(session, "RELEASE_ELIGIBLE", "system", "Client review window expired without a dispute.");
  await putSession(session);
  return NextResponse.json(session);
}
