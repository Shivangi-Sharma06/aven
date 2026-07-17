import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { listSessionsForStream } from "@/lib/session-store";
import {
  authenticateCliRequest,
  formatAmountUnits,
  getEarnedUnits,
  getOnchainStream,
  ratePerSecondUnits,
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
  let sessions = await listSessionsForStream(streamId);
  if (wallet) {
    const walletLower = wallet.toLowerCase();
    const senderLower = stream.sender.toLowerCase();
    const recipientLower = stream.recipient.toLowerCase();
    if (walletLower === recipientLower) {
      // Recipient sees only their own sessions, or sessions with no workerAddress
      sessions = sessions.filter(
        (s) => !s.workerAddress || s.workerAddress.toLowerCase() === walletLower
      );
    }
    // Sender sees ALL sessions for the stream — no filter needed
    // Unrecognized wallet also sees all sessions (public stream data)
  }

  const earnedUnits = await getEarnedUnits(streamId);
  return NextResponse.json(sessions, {
    headers: {
      "x-aven-stream-asset": stream.asset,
      "x-aven-stream-total": formatAmountUnits(stream.totalDepositedUnits),
      "x-aven-stream-status": stream.status,
      "x-aven-worker-address": stream.recipient,
      "x-aven-client-address": stream.sender,
      "x-aven-earned": formatAmountUnits(earnedUnits),
      "x-aven-rate-per-second": formatAmountUnits(ratePerSecondUnits(stream)),
    },
  });
}
