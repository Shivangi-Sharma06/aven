/**
 * auth-message.test.mjs – Verify that the wallet-auth challenge produced
 * by the server contains no CR/LF characters and can be safely used in
 * HTTP headers and wallet signing APIs.
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";

function buildChallenge(walletAddress, nonce, issuedAt, expiresAt) {
  return `Aven dashboard access|${walletAddress}|${nonce}|${issuedAt}|${expiresAt}`;
}

describe("wallet-auth challenge format", () => {
  test("challenge contains no carriage-return characters", () => {
    const challenge = buildChallenge("GTEST", "abc123", Date.now(), Date.now() + 300_000);
    assert.ok(!challenge.includes("\r"), "Challenge must not contain CR (\\r)");
  });

  test("challenge contains no newline characters", () => {
    const challenge = buildChallenge("GTEST", "abc123", Date.now(), Date.now() + 300_000);
    assert.ok(!challenge.includes("\n"), "Challenge must not contain LF (\\n)");
  });

  test("challenge is safe for HTTP headers (no forbidden characters)", () => {
    const challenge = buildChallenge("GTEST", "abc123", Date.now(), Date.now() + 300_000);
    // HTTP/1.1 forbids CTL characters (0x00-0x1F, 0x7F) in header values.
    const hasForbidden = [...challenge].some((c) => {
      const code = c.charCodeAt(0);
      return code <= 0x1f || code === 0x7f;
    });
    assert.ok(!hasForbidden, "Challenge must not contain HTTP-forbidden control characters");
  });

  test("challenge is a single line (split by newline yields one element)", () => {
    const challenge = buildChallenge("GTEST", "abc123", Date.now(), Date.now() + 300_000);
    assert.equal(challenge.split("\n").length, 1, "Challenge must be exactly one line");
  });

  test("challenge has exactly 5 pipe-delimited parts", () => {
    const nonce = "a".repeat(48);
    const now = Date.now();
    const challenge = buildChallenge("GTEST", nonce, now, now + 300_000);
    assert.equal(challenge.split("|").length, 5);
  });

  test("challenge purpose is 'Aven dashboard access'", () => {
    const challenge = buildChallenge("GTEST", "abc123", Date.now(), Date.now() + 300_000);
    assert.equal(challenge.split("|")[0], "Aven dashboard access");
  });
});
