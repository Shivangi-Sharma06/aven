import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getSession } from "@/lib/session-store";
import { addressesEqual, authenticateCliRequest } from "@/lib/work-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const session = await getSession(sessionId);
  if (!session) return apiError("Work session was not found.", 404);
  const token = await authenticateCliRequest(request, "read_streams");
  const queryWallet = new URL(request.url).searchParams.get("wallet") ?? "";
  const wallet = token?.walletAddress ?? queryWallet;
  if (
    !wallet ||
    (!addressesEqual(wallet, session.workerAddress) && !addressesEqual(wallet, session.clientAddress))
  ) {
    return apiError("This wallet cannot view the work session.", 403);
  }
  return NextResponse.json(session);
}
