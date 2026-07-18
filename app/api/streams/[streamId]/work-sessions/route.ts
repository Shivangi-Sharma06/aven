import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { STREAM_CONTRACT_ID } from "@/lib/contracts";
import { listSessionsForStream } from "@/lib/session-store";
import {
  authenticateCliRequest,
  authenticateWalletRequest,
  formatAmountUnits,
  getAvailableUnits,
  getOnchainStream,
  ratePerSecondUnits,
  roleForWallet,
  sessionMatchesOnchainStream,
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
  const wallet = token?.walletAddress ?? authenticateWalletRequest(request) ?? "";
  if (!wallet || roleForWallet(stream, wallet) === "unrelated") {
    return apiError("This wallet cannot view work sessions for the stream.", 403);
  }
  const availableUnits = await getAvailableUnits(streamId);
  const sessions = (await listSessionsForStream(streamId)).filter((session) =>
    sessionMatchesOnchainStream(session, stream),
  );
  return NextResponse.json(sessions, {
    headers: {
      "x-aven-stream-asset": stream.asset,
      "x-aven-stream-contract": STREAM_CONTRACT_ID,
      "x-aven-stream-status": stream.status,
      "x-aven-worker-address": stream.recipient,
      "x-aven-client-address": stream.sender,
      "x-aven-available": formatAmountUnits(availableUnits),
      "x-aven-rate-per-second": formatAmountUnits(ratePerSecondUnits(stream)),
    },
  });
}
