import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getRepository } from "@/lib/github-repository-store";
import { branchExists, commitExists, getBranchHead } from "@/lib/github-service";
import { addressesEqual, authenticateCliRequest, getOnchainStream } from "@/lib/work-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/github/verify-branch
 *
 * Called by `aven stop --ended` to verify a branch exists on the remote
 * GitHub repository.  Authenticated via Bearer CLI token.
 * Body: { streamId: string; branch?: string; commit?: string; expectedHead?: string }
 * The repository name is resolved server-side so a CLI token cannot probe
 * unrelated private repositories installed on the GitHub App.
 */
export async function POST(request: Request) {
  try {
    const token = await authenticateCliRequest(request, "submit_session");
    if (!token) return apiError("Authentication required.", 401);

    const body = await request.json().catch(() => null);
    const streamId = typeof body?.streamId === "string" ? body.streamId.trim() : "";
    const branch = typeof body?.branch === "string" ? body.branch.trim() : "";
    const commit = typeof body?.commit === "string" ? body.commit.trim() : "";
    const expectedHead = typeof body?.expectedHead === "string" ? body.expectedHead.trim() : "";
    if (!streamId || (!branch && !commit)) {
      return apiError("streamId and at least one branch or commit are required.", 400);
    }

    const stream = await getOnchainStream(streamId);
    if (!stream) return apiError("Stream not found.", 404);
    if (
      !addressesEqual(stream.sender, token.walletAddress) &&
      !addressesEqual(stream.recipient, token.walletAddress)
    ) {
      return apiError("Access denied.", 403);
    }
    const repository = await getRepository(streamId);
    if (!repository) return apiError("No repository found for this stream.", 404);

    const [remoteBranchExists, remoteCommitExists, remoteHead] = await Promise.all([
      branch ? branchExists(repository.fullName, branch) : Promise.resolve(undefined),
      commit ? commitExists(repository.fullName, commit) : Promise.resolve(undefined),
      branch && expectedHead ? getBranchHead(repository.fullName, branch) : Promise.resolve(undefined),
    ]);
    const headMatches = remoteHead === undefined
      ? undefined
      : remoteHead !== null && remoteHead.toLowerCase() === expectedHead.toLowerCase();
    const exists = Boolean(
      (remoteBranchExists ?? true) &&
      (remoteCommitExists ?? true) &&
      (headMatches ?? true)
    );
    return NextResponse.json({
      exists,
      branchExists: remoteBranchExists,
      commitExists: remoteCommitExists,
      headMatches,
    });
  } catch (error) {
    return apiError(error);
  }
}
