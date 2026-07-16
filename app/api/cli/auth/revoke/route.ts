import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { revokeCliToken } from "@/lib/cli-auth-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { token?: string };
  if (!body.token) return apiError("A CLI token is required.");
  const revoked = await revokeCliToken(body.token);
  return revoked ? NextResponse.json({ revoked: true }) : apiError("CLI token was not found.", 404);
}
