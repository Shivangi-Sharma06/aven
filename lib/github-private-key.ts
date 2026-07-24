import { createPrivateKey } from "node:crypto";

const PEM_PATTERN =
  /-----BEGIN (RSA PRIVATE KEY|PRIVATE KEY)-----([\s\S]*?)-----END \1-----/;

/**
 * Normalize a GitHub App PEM copied through env editors.
 *
 * Supports real newlines, literal `\n` escapes, and whitespace-flattened PEM
 * values. The returned key is validated by OpenSSL before Octokit sees it.
 */
export function normalizeGithubPrivateKey(value: string): string {
  let candidate = value.trim();
  const quote = candidate[0];
  if ((quote === `"` || quote === `'`) && candidate.at(-1) === quote) {
    candidate = candidate.slice(1, -1).trim();
  }

  candidate = candidate
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n");

  const match = candidate.match(PEM_PATTERN);
  if (!match) {
    throw new Error(
      "GitHub App private key is invalid. GITHUB_APP_PRIVATE_KEY must contain the complete downloaded PEM, including BEGIN and END PRIVATE KEY lines.",
    );
  }

  const [, label, body] = match;
  const payload = body.replace(/\s+/g, "");
  if (
    payload.length < 256 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)
  ) {
    throw new Error(
      "GitHub App private key is invalid. Copy the complete contents of the downloaded .pem file, not the SHA256 fingerprint shown by GitHub.",
    );
  }

  const lines = payload.match(/.{1,64}/g);
  if (!lines) {
    throw new Error("GitHub App private key contains no key material.");
  }

  const normalized = [
    `-----BEGIN ${label}-----`,
    ...lines,
    `-----END ${label}-----`,
    "",
  ].join("\n");

  try {
    const key = createPrivateKey(normalized);
    if (key.asymmetricKeyType !== "rsa" && key.asymmetricKeyType !== "rsa-pss") {
      throw new Error("not an RSA key");
    }
  } catch {
    throw new Error(
      "GitHub App private key could not be decoded. Generate a new private key in the GitHub App settings and upload the complete unencrypted PEM.",
    );
  }

  return normalized;
}
