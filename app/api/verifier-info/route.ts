import { NextResponse } from "next/server";
import { Keypair } from "@stellar/stellar-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the public key derived from AVEN_VERIFIER_SECRET so the
 * /set-verifier page knows which key to register on the contract.
 *
 * Does NOT expose the secret — only the public key.
 */
export async function GET() {
  const secret = process.env.AVEN_VERIFIER_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { verifierPublicKey: null, error: "AVEN_VERIFIER_SECRET is not configured on the server." },
      { status: 500 },
    );
  }
  try {
    const keypair = Keypair.fromSecret(secret);
    return NextResponse.json({ verifierPublicKey: keypair.publicKey() });
  } catch (e: any) {
    return NextResponse.json(
      { verifierPublicKey: null, error: `Invalid AVEN_VERIFIER_SECRET: ${e.message}` },
      { status: 500 },
    );
  }
}
