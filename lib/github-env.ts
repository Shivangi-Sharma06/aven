import "server-only";

/**
 * GitHub App environment variables loader.
 * Call getGithubEnv() lazily — only when GitHub functionality is actually used.
 * Never prefetch or cache globally; env vars are validated on every call to
 * surface misconfiguration clearly.
 */

export type GithubEnv = {
  appId: string;
  privateKey: string;
  installationId: number;
  webhookSecret: string;
  avenOrg: string;
  oauthClientId: string;
  oauthClientSecret: string;
  oauthRedirectUri: string;
};

export function getGithubEnv(): GithubEnv {
  function required(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
  }

  const appId = required("GITHUB_APP_ID");
  // Normalise escaped newlines — common when setting multi-line values via
  // shell exports or CI secrets that stringify the key as a single line.
  const privateKey = required("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n");
  const installationIdRaw = required("GITHUB_APP_INSTALLATION_ID");
  const installationId = Number(installationIdRaw);
  if (!Number.isFinite(installationId) || installationId <= 0) {
    throw new Error(
      `GITHUB_APP_INSTALLATION_ID must be a positive integer, got: ${installationIdRaw}`,
    );
  }
  const webhookSecret = required("GITHUB_WEBHOOK_SECRET");
  const avenOrg = required("GITHUB_AVEN_ORG");
  const oauthClientId = required("GITHUB_OAUTH_CLIENT_ID");
  const oauthClientSecret = required("GITHUB_OAUTH_CLIENT_SECRET");
  const oauthRedirectUri = required("GITHUB_OAUTH_REDIRECT_URI");

  return {
    appId,
    privateKey,
    installationId,
    webhookSecret,
    avenOrg,
    oauthClientId,
    oauthClientSecret,
    oauthRedirectUri,
  };
}
