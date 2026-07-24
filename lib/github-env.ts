import "server-only";

/**
 * GitHub environment variable loaders.
 *
 * OAuth account linking and GitHub App repository management are separate
 * integrations. Keep their validation separate so a developer can link an
 * identity locally without configuring repository automation first.
 *
 * Never prefetch or cache globally; env vars are validated on every call to
 * surface misconfiguration clearly.
 */

export type GithubOAuthEnv = {
  oauthClientId: string;
  oauthClientSecret: string;
  oauthRedirectUri: string;
};

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

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getGithubOAuthEnv(): GithubOAuthEnv {
  return {
    oauthClientId: required("GITHUB_OAUTH_CLIENT_ID"),
    oauthClientSecret: required("GITHUB_OAUTH_CLIENT_SECRET"),
    oauthRedirectUri: required("GITHUB_OAUTH_REDIRECT_URI"),
  };
}

export function getGithubEnv(): GithubEnv {
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
  const oauth = getGithubOAuthEnv();

  return {
    appId,
    privateKey,
    installationId,
    webhookSecret,
    avenOrg,
    ...oauth,
  };
}
