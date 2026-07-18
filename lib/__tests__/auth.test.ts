/**
 * auth.test.ts – Unit tests for the wallet-auth challenge/verify flow.
 *
 * Tests run with Node's built-in test runner (no Jest required):
 *   npx ts-node --esm lib/__tests__/auth.test.ts
 */

import assert from "node:assert/strict";
import test, { describe, beforeEach } from "node:test";
import { createHash, randomBytes } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";

// ---------------------------------------------------------------------------
// Helpers replicated from lib/work-session-server.ts (no server import needed)
// ---------------------------------------------------------------------------
const SIGN_MESSAGE_PREFIX = "Stellar Signed Message:\n";

function verifyWalletSignature(walletAddress: string, message: string, signature: string): boolean {
  try {
    const sigBytes = /^[a-f\d]{128}$/i.test(signature)
      ? Buffer.from(signature, "hex")
      : Buffer.from(signature, "base64");
    const hash = createHash("sha256")
      .update(`${SIGN_MESSAGE_PREFIX}${message}`, "utf8")
      .digest();
    return Keypair.fromPublicKey(walletAddress).verify(hash, sigBytes);
  } catch {
    return false;
  }
}

function buildChallenge(walletAddress: string, nonce: string, issuedAt: number, expiresAt: number) {
  return `Aven dashboard access|${walletAddress}|${nonce}|${issuedAt}|${expiresAt}`;
}

function signChallenge(keypair: Keypair, challenge: string): string {
  const hash = createHash("sha256")
    .update(`${SIGN_MESSAGE_PREFIX}${challenge}`, "utf8")
    .digest();
  return keypair.sign(hash).toString("base64");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("challenge message safety", () => {
  test("challenge contains no CR or LF characters", () => {
    const address = Keypair.random().publicKey();
    const nonce = randomBytes(24).toString("hex");
    const now = Date.now();
    const challenge = buildChallenge(address, nonce, now, now + 5 * 60_000);
    assert.ok(!/[\r\n]/.test(challenge), "Challenge must contain no CR/LF characters");
  });

  test("challenge is a single line (no newlines)", () => {
    const address = Keypair.random().publicKey();
    const nonce = randomBytes(24).toString("hex");
    const now = Date.now();
    const challenge = buildChallenge(address, nonce, now, now + 5 * 60_000);
    const lines = challenge.split("\n");
    assert.equal(lines.length, 1, "Challenge must be exactly one line");
  });
});

describe("wallet signature verification", () => {
  test("valid signature verifies correctly", () => {
    const keypair = Keypair.random();
    const nonce = randomBytes(24).toString("hex");
    const now = Date.now();
    const challenge = buildChallenge(keypair.publicKey(), nonce, now, now + 5 * 60_000);
    const signature = signChallenge(keypair, challenge);
    assert.ok(verifyWalletSignature(keypair.publicKey(), challenge, signature));
  });

  test("wrong wallet address fails verification", () => {
    const signer = Keypair.random();
    const attacker = Keypair.random();
    const nonce = randomBytes(24).toString("hex");
    const now = Date.now();
    const challenge = buildChallenge(signer.publicKey(), nonce, now, now + 5 * 60_000);
    const signature = signChallenge(signer, challenge);
    // Trying to verify with a different (attacker) address should fail
    assert.equal(verifyWalletSignature(attacker.publicKey(), challenge, signature), false);
  });

  test("tampered challenge fails verification", () => {
    const keypair = Keypair.random();
    const nonce = randomBytes(24).toString("hex");
    const now = Date.now();
    const original = buildChallenge(keypair.publicKey(), nonce, now, now + 5 * 60_000);
    const signature = signChallenge(keypair, original);
    // Tamper by changing the expiry
    const tampered = original.replace(String(now + 5 * 60_000), String(now + 60 * 60_000));
    assert.equal(verifyWalletSignature(keypair.publicKey(), tampered, signature), false);
  });
});

describe("challenge validation logic", () => {
  function validateChallenge(walletAddress: string, challenge: string): string | null {
    if (/[\r\n]/.test(challenge)) return "CR/LF in challenge";
    const parts = challenge.split("|");
    if (parts.length !== 5) return "wrong number of parts";
    const [purpose, challengeAddress, , issuedRaw, expiresRaw] = parts;
    const issuedAt = Number(issuedRaw);
    const expiresAt = Number(expiresRaw);
    const now = Date.now();
    if (purpose !== "Aven dashboard access") return "wrong purpose";
    if (challengeAddress.toUpperCase() !== walletAddress.toUpperCase()) return "address mismatch";
    if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt)) return "invalid timestamps";
    if (issuedAt > now + 30_000) return "issued in future";
    if (expiresAt <= now) return "expired";
    if (expiresAt - issuedAt > 10 * 60_000) return "window too long";
    return null; // valid
  }

  test("expired challenge is rejected", () => {
    const address = Keypair.random().publicKey();
    const nonce = randomBytes(24).toString("hex");
    const past = Date.now() - 10 * 60_000;
    const challenge = buildChallenge(address, nonce, past, past + 5 * 60_000);
    assert.equal(validateChallenge(address, challenge), "expired");
  });

  test("challenge issued far in the future is rejected", () => {
    const address = Keypair.random().publicKey();
    const nonce = randomBytes(24).toString("hex");
    const future = Date.now() + 60 * 60_000;
    const challenge = buildChallenge(address, nonce, future, future + 5 * 60_000);
    assert.equal(validateChallenge(address, challenge), "issued in future");
  });

  test("challenge for a different wallet is rejected", () => {
    const wallet1 = Keypair.random().publicKey();
    const wallet2 = Keypair.random().publicKey();
    const nonce = randomBytes(24).toString("hex");
    const now = Date.now();
    const challenge = buildChallenge(wallet1, nonce, now, now + 5 * 60_000);
    assert.equal(validateChallenge(wallet2, challenge), "address mismatch");
  });

  test("valid challenge passes validation", () => {
    const address = Keypair.random().publicKey();
    const nonce = randomBytes(24).toString("hex");
    const now = Date.now();
    const challenge = buildChallenge(address, nonce, now, now + 5 * 60_000);
    assert.equal(validateChallenge(address, challenge), null);
  });
});

describe("nonce replay prevention (in-memory simulation)", () => {
  let usedNonces: Set<string>;

  beforeEach(() => {
    usedNonces = new Set();
  });

  function consumeNonce(nonce: string): boolean {
    if (usedNonces.has(nonce)) return false;
    usedNonces.add(nonce);
    return true;
  }

  test("nonce can be consumed once", () => {
    const nonce = randomBytes(24).toString("hex");
    assert.ok(consumeNonce(nonce));
  });

  test("nonce cannot be replayed", () => {
    const nonce = randomBytes(24).toString("hex");
    assert.ok(consumeNonce(nonce));
    assert.equal(consumeNonce(nonce), false);
  });

  test("different nonces do not interfere", () => {
    const n1 = randomBytes(24).toString("hex");
    const n2 = randomBytes(24).toString("hex");
    assert.ok(consumeNonce(n1));
    assert.ok(consumeNonce(n2));
    assert.equal(consumeNonce(n1), false);
    assert.equal(consumeNonce(n2), false);
  });
});
