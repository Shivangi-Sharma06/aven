import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { normalizeGithubPrivateKey } from "../github-private-key.ts";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

test("accepts a normal multiline GitHub App PEM", () => {
  const normalized = normalizeGithubPrivateKey(privateKey);
  assert.match(normalized, /^-----BEGIN RSA PRIVATE KEY-----\n/);
  assert.match(normalized, /\n-----END RSA PRIVATE KEY-----\n$/);
});

test("repairs a whitespace-flattened GitHub App PEM", () => {
  const flattened = privateKey.replace(/\n/g, " ");
  const normalized = normalizeGithubPrivateKey(flattened);
  assert.equal(normalized, normalizeGithubPrivateKey(privateKey));
});

test("accepts literal newline escapes used by env editors", () => {
  const escaped = privateKey.replace(/\n/g, "\\n");
  const normalized = normalizeGithubPrivateKey(escaped);
  assert.equal(normalized, normalizeGithubPrivateKey(privateKey));
});

test("rejects a GitHub key fingerprint instead of a PEM", () => {
  assert.throws(
    () => normalizeGithubPrivateKey("SHA256:not-a-private-key"),
    /complete downloaded PEM/,
  );
});
