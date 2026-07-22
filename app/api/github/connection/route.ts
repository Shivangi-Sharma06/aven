import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getIdentity } from "@/lib/github-identity-store";
import { authenticateBrowserSession } from "@/lib/work-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/github/connection
 *
 * Returns the authenticated user's GitHub identity record, or
 * `{ connected: false }` if no identity is linked.
 */
export async function GET(request: Request) {
  try {
    const walletAddress = await authenticateBrowserSession(request);
    if (!walletAddress) return apiError("Authentication required.", 401);

    const identity = await getIdentity(walletAddress);
    if (!identity) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      githubLogin: identity.githubLogin,
      githubUserId: identity.githubUserId,
      avatarUrl: identity.avatarUrl,
      linkedAt: identity.linkedAt,
    });
  } catch (error) {
    return apiError(error);
  }
}
