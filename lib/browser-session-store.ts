import "server-only";

import { randomBytes } from "node:crypto";
import { assertProductionPersistence, dataNamespace, sharedRedis } from "./server-persistence";

// ---------------------------------------------------------------------------
// In-memory fallbacks for local development (when Redis is not configured)
// ---------------------------------------------------------------------------
const localNonces = new Map<string, { walletAddress: string; expiresAt: number }>();
const localSessions = new Map<string, { walletAddress: string; expiresAt: number }>();

// ---------------------------------------------------------------------------
// TTLs
// ---------------------------------------------------------------------------
const NONCE_TTL_SECONDS = 5 * 60; // 5 minutes
const SESSION_TTL_SECONDS = 15 * 60; // 15 minutes

// ---------------------------------------------------------------------------
// Redis keys
// ---------------------------------------------------------------------------
function nonceKey(nonce: string) {
  return `${dataNamespace}:nonce:${nonce}`;
}

function browserSessionKey(sessionId: string) {
  return `${dataNamespace}:browser-session:${sessionId}`;
}

// ---------------------------------------------------------------------------
// Nonce management
// ---------------------------------------------------------------------------

export async function createAuthNonce(walletAddress: string): Promise<string> {
  assertProductionPersistence();
  const nonce = randomBytes(24).toString("hex");
  if (sharedRedis) {
    await sharedRedis.set(
      nonceKey(nonce),
      walletAddress,
      { ex: NONCE_TTL_SECONDS },
    );
  } else {
    localNonces.set(nonce, {
      walletAddress,
      expiresAt: Date.now() + NONCE_TTL_SECONDS * 1_000,
    });
  }
  return nonce;
}

/**
 * Atomically reads and deletes a nonce, returning the associated wallet address
 * or null if the nonce does not exist or has expired.  The atomic delete prevents
 * replay attacks.
 */
export async function consumeAuthNonce(nonce: string): Promise<string | null> {
  assertProductionPersistence();
  if (sharedRedis) {
    // GETDEL is atomic: read + delete in one round-trip
    const walletAddress = await sharedRedis.getdel<string>(nonceKey(nonce));
    return walletAddress ?? null;
  }
  const entry = localNonces.get(nonce);
  if (!entry) return null;
  localNonces.delete(nonce);
  if (entry.expiresAt <= Date.now()) return null;
  return entry.walletAddress;
}

// ---------------------------------------------------------------------------
// Browser session management
// ---------------------------------------------------------------------------

export async function createBrowserSession(walletAddress: string): Promise<string> {
  assertProductionPersistence();
  const sessionId = randomBytes(32).toString("hex");
  if (sharedRedis) {
    await sharedRedis.set(
      browserSessionKey(sessionId),
      walletAddress,
      { ex: SESSION_TTL_SECONDS },
    );
  } else {
    localSessions.set(sessionId, {
      walletAddress,
      expiresAt: Date.now() + SESSION_TTL_SECONDS * 1_000,
    });
  }
  return sessionId;
}

export async function getBrowserSession(sessionId: string): Promise<string | null> {
  assertProductionPersistence();
  if (sharedRedis) {
    return (await sharedRedis.get<string>(browserSessionKey(sessionId))) ?? null;
  }
  const entry = localSessions.get(sessionId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    localSessions.delete(sessionId);
    return null;
  }
  return entry.walletAddress;
}

export async function deleteBrowserSession(sessionId: string): Promise<void> {
  assertProductionPersistence();
  if (sharedRedis) {
    await sharedRedis.del(browserSessionKey(sessionId));
  } else {
    localSessions.delete(sessionId);
  }
}
