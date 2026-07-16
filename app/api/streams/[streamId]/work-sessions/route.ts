import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { listSessionsForStream } from "@/lib/session-store";
import {
  authenticateCliRequest,
  formatAmountUnits,
  getEarnedUnits,
  getOnchainStream,
  roleForWallet,
} from "@/lib/work-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ streamId: string }> },
) {
  const { streamId } = await context.params;
  const stream = await getOnchainStream(streamId);
  if (!stream) return apiError("Stream was not found.", 404);
  const token = await authenticateCliRequest(request, "read_streams");
  const wallet = token?.walletAddress ?? new URL(request.url).searchParams.get("wallet") ?? "";
  if (!wallet || roleForWallet(stream, wallet) === "unrelated") {
    return apiError("This wallet cannot view work sessions for the stream.", 403);
  }
  const earnedUnits = await getEarnedUnits(streamId);
  return NextResponse.json(await listSessionsForStream(streamId), {
    headers: {
      "x-aven-stream-asset": stream.asset,
      "x-aven-stream-status": stream.status,
      "x-aven-worker-address": stream.recipient,
      "x-aven-client-address": stream.sender,
      "x-aven-earned": formatAmountUnits(earnedUnits),
    },
  });
}
