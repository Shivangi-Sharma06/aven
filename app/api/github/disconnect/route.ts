import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getIdentity, deleteIdentityWithIndex } from "@/lib/github-identity-store";
import { authenticateBrowserSession } from "@/lib/work-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/github/disconnect
 *
 * Removes the GitHub identity link for the authenticated browser user.
 * Also removes the reverse userId→walletAddress index.
 */
export async function POST(request: Request) {
  try {
    const walletAddress = await authenticateBrowserSession(request);
    if (!walletAddress) return apiError("Authentication required.", 401);

    const identity = await getIdentity(walletAddress);
    if (!identity) {
      // Idempotent — already disconnected is fine
      return NextResponse.json({ ok: true });
    }

    await deleteIdentityWithIndex(walletAddress, identity.githubUserId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
