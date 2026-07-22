import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getRepository, putRepository, findStreamIdByRepoId } from "@/lib/github-repository-store";
import { transferRepository, getRepositoryOwner } from "@/lib/github-service";
import { authenticateBrowserSession, addressesEqual, getOnchainStream } from "@/lib/work-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ streamId: string }> };

/**
 * POST /api/streams/[streamId]/repository/transfer
 *
 * Initiates repository transfer to destination (GitHub user/org).
 * Runs all preflight checks again internally — never trusts a prior preflight call.
 * Body: { destination: string }
 *
 * State transitions: ACTIVE → TRANSFER_PENDING → TRANSFER_READY
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
    if (!addressesEqual(stream.sender, walletAddress)) {
      return apiError("Only the stream sender can initiate a transfer.", 403);
    }

    const repository = await getRepository(streamId);
    if (!repository) return apiError("No repository found for this stream.", 404);

    if (repository.status !== "ACTIVE" && repository.status !== "TRANSFER_FAILED") {
      return apiError(
        `Cannot transfer: repository status is ${repository.status}.`,
        409,
      );
    }

    const now = new Date().toISOString();

    // Mark as TRANSFER_PENDING before calling GitHub (prevents double-submit)
    await putRepository({
      ...repository,
      status: "TRANSFER_PENDING",
      transferDestination: destination,
      updatedAt: now,
    });

    try {
      await transferRepository(repository.fullName, destination);
    } catch (err) {
      // Rollback to TRANSFER_FAILED so the client can retry
      await putRepository({
        ...repository,
        status: "TRANSFER_FAILED",
        transferDestination: destination,
        lastError: err instanceof Error ? err.message : String(err),
        updatedAt: new Date().toISOString(),
      });
      return apiError(`Transfer failed: ${err instanceof Error ? err.message : String(err)}`, 502);
    }

    // GitHub accepted the transfer — mark as TRANSFER_READY (not yet TRANSFERRED)
    await putRepository({
      ...repository,
      status: "TRANSFER_READY",
      transferDestination: destination,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ pending: true, destination });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * GET /api/streams/[streamId]/repository/transfer
 *
 * Reconciliation endpoint — checks actual GitHub repo owner and updates status.
 * TRANSFER_PENDING → TRANSFERRED (if owner matches destination)
 * TRANSFER_PENDING → TRANSFER_FAILED (if unexpected owner)
 */
export async function GET(request: Request, context: Params) {
  const { streamId } = await context.params;
  try {
    const walletAddress = await authenticateBrowserSession(request);
    if (!walletAddress) return apiError("Authentication required.", 401);

    const stream = await getOnchainStream(streamId);
    if (!stream) return apiError("Stream not found.", 404);

    const isSender = addressesEqual(stream.sender, walletAddress);
    const isRecipient = addressesEqual(stream.recipient, walletAddress);
    if (!isSender && !isRecipient) return apiError("Access denied.", 403);

    const repository = await getRepository(streamId);
    if (!repository) return apiError("No repository found.", 404);

    if (repository.status !== "TRANSFER_PENDING" && repository.status !== "TRANSFER_READY") {
      return NextResponse.json(repository);
    }

    const currentOwner = await getRepositoryOwner(repository.githubRepositoryId);
    const expectedDestination = repository.transferDestination;
    const now = new Date().toISOString();

    if (expectedDestination && currentOwner.toLowerCase() === expectedDestination.toLowerCase()) {
      await putRepository({
        ...repository,
        status: "TRANSFERRED",
        transferredAt: now,
        updatedAt: now,
      });
    } else if (currentOwner.toLowerCase() === repository.owner.toLowerCase()) {
      // Still in original org — transfer pending with GitHub
      // Keep status as-is
    } else {
      // Unexpected owner
      await putRepository({
        ...repository,
        status: "TRANSFER_FAILED",
        lastError: `Unexpected owner after transfer: ${currentOwner}`,
        updatedAt: now,
      });
    }

    return NextResponse.json(await getRepository(streamId));
  } catch (error) {
    return apiError(error);
  }
}
