import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getIdentity } from "@/lib/github-identity-store";
import { getRepository, putRepository } from "@/lib/github-repository-store";
import { createRepository, addCollaborator } from "@/lib/github-service";
import { authenticateBrowserSession, authenticateCliRequest, addressesEqual, getOnchainStream } from "@/lib/work-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lowercase, replace non-alphanumeric with hyphens, trim to 100 chars. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

type Params = { params: Promise<{ streamId: string }> };

/**
 * POST /api/streams/[streamId]/repository
 *
 * Creates a GitHub repository for the stream project.
 * Idempotent: returns the existing record if one already exists.
 * Caller must be the stream sender (client).
 * Both sender and recipient must have linked GitHub accounts.
 */
export async function POST(request: Request, context: Params) {
  const { streamId } = await context.params;
  try {
    const walletAddress = await authenticateBrowserSession(request);
    if (!walletAddress) return apiError("Authentication required.", 401);

    // Fetch the stream and verify caller is the sender
    const stream = await getOnchainStream(streamId);
    if (!stream) return apiError("Stream not found.", 404);
    if (!addressesEqual(stream.sender, walletAddress)) {
      return apiError("Only the stream sender can create a project repository.", 403);
    }
    if (stream.status !== "active") {
      return apiError(`Stream is ${stream.status} — cannot create repository.`, 409);
    }

    // Idempotency check. A CREATING record represents a repository that was
    // created successfully but whose collaborator setup was interrupted.
    const existing = await getRepository(streamId);
    if (existing && existing.status !== "CREATING") {
      return NextResponse.json(existing);
    }

    // Resolve both GitHub identities
    const [clientIdentity, workerIdentity] = await Promise.all([
      getIdentity(stream.sender),
      getIdentity(stream.recipient),
    ]);

    if (!clientIdentity) {
      return NextResponse.json(
        {
          error: "The stream sender has not linked a GitHub account.",
          action: "/api/github/connect",
        },
        { status: 422 },
      );
    }
    if (!workerIdentity) {
      return NextResponse.json(
        {
          error: "The stream recipient has not linked a GitHub account.",
          action: "/api/github/connect",
        },
        { status: 422 },
      );
    }

    if (existing) {
      try {
        await Promise.all([
          addCollaborator(existing.fullName, workerIdentity.githubLogin, "push"),
          addCollaborator(existing.fullName, clientIdentity.githubLogin, "pull"),
        ]);
        const active = {
          ...existing,
          status: "ACTIVE" as const,
          lastError: undefined,
          updatedAt: new Date().toISOString(),
        };
        await putRepository(active);
        return NextResponse.json(active);
      } catch (error) {
        await putRepository({
          ...existing,
          lastError: error instanceof Error ? error.message : String(error),
          updatedAt: new Date().toISOString(),
        });
        throw error;
      }
    }

    // Parse optional project title from body
    let projectTitle = `stream-${streamId}`;
    try {
      const body = await request.json().catch(() => null);
      if (body?.projectTitle && typeof body.projectTitle === "string") {
        projectTitle = body.projectTitle;
      }
    } catch {
      // Use default title
    }

    const repoName = `aven-${streamId}-${slugify(projectTitle)}`;
    const description = `Aven managed project repository for stream #${streamId}`;

    const now = new Date().toISOString();

    // Create the repository
    const repo = await createRepository({ name: repoName, description });

    const record = {
      streamId,
      githubRepositoryId: repo.id,
      owner: repo.fullName.split("/")[0],
      name: repo.fullName.split("/")[1],
      fullName: repo.fullName,
      htmlUrl: repo.htmlUrl,
      cloneUrl: repo.cloneUrl,
      sshUrl: repo.sshUrl,
      defaultBranch: repo.defaultBranch || undefined,
      visibility: "private" as const,
      workerGithubUserId: workerIdentity.githubUserId,
      clientGithubUserId: clientIdentity.githubUserId,
      workerPermission: "push" as const,
      clientPermission: "pull" as const,
      status: "CREATING" as const,
      createdAt: now,
      updatedAt: now,
    };

    await putRepository(record);
    try {
      await Promise.all([
        addCollaborator(repo.fullName, workerIdentity.githubLogin, "push"),
        addCollaborator(repo.fullName, clientIdentity.githubLogin, "pull"),
      ]);
    } catch (error) {
      await putRepository({
        ...record,
        lastError: error instanceof Error ? error.message : String(error),
        updatedAt: new Date().toISOString(),
      });
      throw error;
    }
    const activeRecord = {
      ...record,
      status: "ACTIVE" as const,
      updatedAt: new Date().toISOString(),
    };
    await putRepository(activeRecord);
    return NextResponse.json(activeRecord, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * GET /api/streams/[streamId]/repository
 *
 * Returns the project repository record for the stream.
 * Caller must be the stream sender or recipient.
 */
export async function GET(request: Request, context: Params) {
  const { streamId } = await context.params;
  try {
    const browserWallet = await authenticateBrowserSession(request);
    const cliToken = browserWallet ? null : await authenticateCliRequest(request, "read_streams");
    const walletAddress = browserWallet ?? cliToken?.walletAddress ?? null;
    if (!walletAddress) return apiError("Authentication required.", 401);

    const stream = await getOnchainStream(streamId);
    if (!stream) return apiError("Stream not found.", 404);

    const isSender = addressesEqual(stream.sender, walletAddress);
    const isRecipient = addressesEqual(stream.recipient, walletAddress);
    if (!isSender && !isRecipient) {
      return apiError("Access denied.", 403);
    }

    const record = await getRepository(streamId);
    if (!record) return apiError("No repository found for this stream.", 404);

    return NextResponse.json(record);
  } catch (error) {
    return apiError(error);
  }
}
