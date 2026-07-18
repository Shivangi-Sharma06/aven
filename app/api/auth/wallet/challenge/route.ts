import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { createAuthNonce } from "@/lib/browser-session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/wallet/challenge
 *
 * Accepts { walletAddress } and returns a single-line challenge string the
 * browser wallet can sign.  The challenge contains no CR/LF characters.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const walletAddress = (body?.walletAddress ?? "").trim();
    if (!/^G[A-Z2-7]{55}$/.test(walletAddress)) {
      return apiError("A valid Stellar wallet address is required.", 400);
    }

    const nonce = await createAuthNonce(walletAddress);
    const issuedAt = Date.now();
    const expiresAt = issuedAt + 5 * 60_000;

    // Build a challenge with no newlines — pipe-delimited, single line.
    const challenge = `Aven dashboard access|${walletAddress}|${nonce}|${issuedAt}|${expiresAt}`;

    return NextResponse.json({ nonce, challenge, expiresAt });
  } catch (error) {
    return apiError(error);
  }
}
