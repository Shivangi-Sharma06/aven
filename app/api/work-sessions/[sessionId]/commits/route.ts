import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getSession } from "@/lib/session-store";
import { getRepository } from "@/lib/github-repository-store";
import { compareCommits } from "@/lib/github-service";
import { authenticateBrowserSession, addressesEqual } from "@/lib/work-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ sessionId: string }> };

/**
 * GET /api/work-sessions/[sessionId]/commits
 *
 * Returns only the commits array for the work session's commit range.
 * Caller must be the stream sender or recipient.
 */
export async function GET(request: Request, context: Params) {
  const { sessionId } = await context.params;
  try {
    const walletAddress = await authenticateBrowserSession(request);
    if (!walletAddress) return apiError("Authentication required.", 401);

    const session = await getSession(sessionId);
    if (!session) return apiError("Work session not found.", 404);

    const isWorker = addressesEqual(session.workerAddress, walletAddress);
    const isClient = addressesEqual(session.clientAddress, walletAddress);
    if (!isWorker && !isClient) {
      return apiError("Access denied.", 403);
    }

    const repoRecord = await getRepository(session.streamId);
    if (!repoRecord) {
      return NextResponse.json({ reason: "no_github_repository" }, { status: 404 });
    }

    const startingCommit = session.report?.repository.startingCommit;
    const endingCommit = session.report?.repository.endingCommit;
    if (!startingCommit || !endingCommit) {
      return NextResponse.json({ reason: "no_commits" }, { status: 404 });
    }

    const compare = await compareCommits(repoRecord.fullName, startingCommit, endingCommit);
    return NextResponse.json({ commits: compare.commits });
  } catch (error) {
    return apiError(error);
  }
}
