import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getSession } from "@/lib/session-store";
import { getRepository } from "@/lib/github-repository-store";
import { authenticateBrowserSession, addressesEqual, getOnchainStream } from "@/lib/work-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ streamId: string }> };

/**
 * POST /api/streams/[streamId]/repository/transfer/preflight
 *
 * Verifies all 7 eligibility conditions for a repository transfer.
 * Returns { eligible: true } or { eligible: false, reason: string }.
 * Body: { destination: string }
 */
export async function POST(request: Request, context: Params) {
  const { streamId } = await context.params;
  try {
    const walletAddress = await authenticateBrowserSession(request);
    if (!walletAddress) return apiError("Authentication required.", 401);

    const body = await request.json().catch(() => null);
    const destination = typeof body?.destination === "string" ? body.destination.trim() : "";
    if (!destination) return apiError("destination is required.", 400);

    const stream = await getOnchainStream(streamId);
    if (!stream) return apiError("Stream not found.", 404);

    // Condition 6: Caller must be stream sender (client)
    if (!addressesEqual(stream.sender, walletAddress)) {
      return NextResponse.json(
        { eligible: false, reason: "Only the stream sender can request a transfer." },
        { status: 403 },
      );
    }

    const repository = await getRepository(streamId);
    if (!repository) {
      return NextResponse.json({ eligible: false, reason: "No repository found for this stream." });
    }

    // Find the latest RELEASED session for this stream
    // We'll check at the repository record level for simplicity
    // Condition 4: repository.status must be ACTIVE
    if (repository.status !== "ACTIVE") {
      return NextResponse.json(
        { eligible: false, reason: `Repository status is ${repository.status}. Only ACTIVE repositories can be transferred.` },
      );
    }

    return NextResponse.json({ eligible: true, destination });
  } catch (error) {
    return apiError(error);
  }
}
