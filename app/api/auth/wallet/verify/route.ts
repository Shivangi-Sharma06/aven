import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { consumeAuthNonce, createBrowserSession } from "@/lib/browser-session-store";
import { addressesEqual, verifyWalletSignature } from "@/lib/work-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_TTL_SECONDS = 15 * 60;
const COOKIE_NAME = "aven_session";

/**
 * POST /api/auth/wallet/verify
 *
 * Accepts { walletAddress, challenge, signature }.
 * - Validates the challenge has no CR/LF characters.
 * - Parses and validates the nonce, timing, and address.
 * - Consumes the nonce atomically from Redis (prevents replay).
 * - Verifies the Ed25519 wallet signature.
 * - Creates a Redis-backed browser session.
 * - Sets a Secure, HttpOnly, SameSite=Lax cookie.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return apiError("JSON body is required.", 400);

    const walletAddress = (body.walletAddress ?? "").trim();
    const challenge: string = body.challenge ?? "";
    const signature: string = body.signature ?? "";

    // Security: challenge must have no CR or LF characters.
    if (/[\r\n]/.test(challenge)) {
      return apiError("Challenge must not contain newline characters.", 400);
    }

    // Parse pipe-delimited challenge.
    const parts = challenge.split("|");
    if (parts.length !== 5) {
      return apiError("Invalid challenge format.", 400);
    }
    const [purpose, challengeAddress, nonce, issuedRaw, expiresRaw] = parts;
    const issuedAt = Number(issuedRaw);
    const expiresAt = Number(expiresRaw);
    const now = Date.now();

    if (purpose !== "Aven dashboard access") {
      return apiError("Invalid challenge purpose.", 400);
    }
    if (!addressesEqual(walletAddress, challengeAddress)) {
      return apiError("Challenge address does not match the provided wallet address.", 400);
    }
    if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt)) {
      return apiError("Invalid challenge timestamps.", 400);
    }
    if (issuedAt > now + 30_000) {
      return apiError("Challenge was issued in the future.", 400);
    }
    if (expiresAt <= now) {
      return apiError("Challenge has expired.", 401);
    }
    if (expiresAt - issuedAt > 10 * 60_000) {
      return apiError("Challenge validity window is too long.", 400);
    }
    if (!nonce || nonce.length < 20) {
      return apiError("Invalid nonce format.", 400);
    }

    // Verify wallet signature (Ed25519 / Stellar).
    if (!signature || !verifyWalletSignature(walletAddress, challenge, signature)) {
      return apiError("Wallet signature verification failed.", 401);
    }

    // Atomically consume nonce — prevents replay.
    const storedAddress = await consumeAuthNonce(nonce);
    if (!storedAddress) {
      return apiError("Nonce not found or already used.", 401);
    }
    if (!addressesEqual(storedAddress, walletAddress)) {
      return apiError("Nonce was issued for a different wallet address.", 401);
    }

    // Create a Redis-backed browser session.
    const sessionId = await createBrowserSession(walletAddress);

    // Cookie flags: Secure only in production (localhost needs no Secure flag).
    const secure = request.url.startsWith("https://");
    const cookieOptions = [
      `${COOKIE_NAME}=${sessionId}`,
      `Max-Age=${SESSION_TTL_SECONDS}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      ...(secure ? ["Secure"] : []),
    ].join("; ");

    const response = NextResponse.json({ ok: true });
    response.headers.set("Set-Cookie", cookieOptions);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
