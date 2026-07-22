import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getRepository, putRepository, findStreamIdByRepoId } from "@/lib/github-repository-store";
import { getGithubEnv } from "@/lib/github-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/github/webhook
 *
 * Receives GitHub App webhook events.
 * Security: HMAC-SHA256 signature verification using GITHUB_WEBHOOK_SECRET.
 * Handles: repository event, action=transferred
 * Returns 200 for all valid deliveries (even unhandled events).
 */
export async function POST(request: Request) {
  try {
    // Read raw body as Buffer for signature verification
    const rawBody = Buffer.from(await request.arrayBuffer());
    const signature = request.headers.get("x-hub-signature-256") ?? "";
    const event = request.headers.get("x-github-event") ?? "";

    // Verify HMAC-SHA256 signature
    const env = getGithubEnv();
    const expected = `sha256=${createHmac("sha256", env.webhookSecret).update(rawBody).digest("hex")}`;

    // Use timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    const signatureValid =
      signatureBuffer.length === expectedBuffer.length &&
      timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!signatureValid) {
      // Do not log the signature or body on failure
      return new Response("Forbidden", { status: 403 });
    }

    // Parse payload (never log it — may contain sensitive repository metadata)
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    // Handle repository.transferred event
    if (event === "repository") {
      const action = (payload as any)?.action;
      if (action === "transferred") {
        const repoId = (payload as any)?.repository?.id as number | undefined;
        const newOwner = (payload as any)?.repository?.owner?.login as string | undefined;

        if (repoId && newOwner) {
          const streamId = await findStreamIdByRepoId(repoId);
          if (streamId) {
            const repository = await getRepository(streamId);
            if (repository && repository.transferDestination) {
              const destinationMatches =
                newOwner.toLowerCase() === repository.transferDestination.toLowerCase();
              if (destinationMatches) {
                const now = new Date().toISOString();
                await putRepository({
                  ...repository,
                  status: "TRANSFERRED",
                  transferredAt: now,
                  updatedAt: now,
                });
              }
            }
          }
        }
      }
    }

    // Always return 200 for valid deliveries (even for unhandled event types)
    return NextResponse.json({ ok: true });
  } catch {
    // Do not expose internal error details in webhook responses
    return new Response("Internal Server Error", { status: 500 });
  }
}
