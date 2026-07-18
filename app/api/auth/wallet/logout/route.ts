import { NextResponse } from "next/server";
import { deleteBrowserSession } from "@/lib/browser-session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "aven_session";

/**
 * POST /api/auth/wallet/logout
 *
 * Reads the aven_session cookie, deletes the Redis session entry,
 * and clears the cookie.
 */
export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`).exec(cookieHeader);
  const sessionId = match?.[1];

  if (sessionId) {
    try {
      await deleteBrowserSession(sessionId);
    } catch {
      // Best-effort deletion — clear the cookie regardless.
    }
  }

  const response = NextResponse.json({ ok: true });
  // Clear cookie by setting Max-Age=0
  response.headers.set(
    "Set-Cookie",
    `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`,
  );
  return response;
}
