import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { listPendingReviewForClient } from "@/lib/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/work-sessions/pending?wallet=<clientAddress>
 * Returns all PENDING_CLIENT_REVIEW sessions for the given client wallet address.
 * Used by the dashboard to show pending-review warnings to clients.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get("wallet")?.trim();
    if (!wallet) return apiError("wallet query param is required.", 400);
    const sessions = await listPendingReviewForClient(wallet);
    return NextResponse.json(sessions);
  } catch (e: any) {
    return apiError(e?.message ?? "Failed to fetch pending sessions.", 500);
  }
}
