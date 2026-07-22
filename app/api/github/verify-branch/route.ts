import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getRepository } from "@/lib/github-repository-store";
import { branchExists } from "@/lib/github-service";
import { authenticateCliRequest } from "@/lib/work-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/github/verify-branch
 *
 * Called by `aven stop --ended` to verify a branch exists on the remote
 * GitHub repository.  Authenticated via Bearer CLI token.
 * Body: { fullName: string; branch: string }
 * Returns: { exists: boolean }
 */
export async function POST(request: Request) {
  try {
    const token = await authenticateCliRequest(request, "submit_session");
    if (!token) return apiError("Authentication required.", 401);

    const body = await request.json().catch(() => null);
    const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
    const branch = typeof body?.branch === "string" ? body.branch.trim() : "";
    if (!fullName || !branch) return apiError("fullName and branch are required.", 400);

    const exists = await branchExists(fullName, branch);
    return NextResponse.json({ exists });
  } catch (error) {
    return apiError(error);
  }
}
