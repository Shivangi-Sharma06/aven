import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { checkTransferEligibility } from "@/lib/github-transfer";
import { authenticateBrowserSession } from "@/lib/work-session-server";

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

    const eligibility = await checkTransferEligibility({ streamId, walletAddress, destination });
    if (!eligibility.eligible) {
      return NextResponse.json(
        { eligible: false, reason: eligibility.reason },
        { status: eligibility.status },
      );
    }
    return NextResponse.json({ eligible: true });
  } catch (error) {
    return apiError(error);
  }
}
