import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { consumeOAuthState, findWalletByGithubUserId, putIdentityWithIndex } from "@/lib/github-identity-store";
import { getGithubEnv } from "@/lib/github-env";
import { authenticateBrowserSession } from "@/lib/work-session-server";
import { addressesEqual } from "@/lib/work-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/github/callback
 *
 * Handles the GitHub OAuth callback:
 * 1. Reads `code` and `state` from query params
 * 2. Atomically consumes the state (GETDEL) — rejects if missing/expired
 * 3. Verifies browser session wallet matches state's wallet
 * 4. Exchanges code for access token
 * 5. Fetches GitHub user identity
 * 6. Checks for conflicting wallet ownership
 * 7. Stores GithubIdentityRecord
 * 8. Redirects to /profile/{walletAddress}
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      return apiError("Missing code or state parameter.", 400);
    }

    // Atomically consume state — prevents replay attacks
    const stateValue = await consumeOAuthState(state);
    if (!stateValue) {
      return apiError("Invalid or expired OAuth state. Please try connecting again.", 400);
    }

    // Authenticate browser session and verify wallet matches state
    const walletAddress = await authenticateBrowserSession(request);
    if (!walletAddress) {
      return apiError("Authentication required. Please sign in and try again.", 401);
    }
    if (!addressesEqual(walletAddress, stateValue.walletAddress)) {
      return apiError("Session wallet does not match OAuth state. Please try again.", 403);
    }

    const env = getGithubEnv();

    // Exchange authorization code for access token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: env.oauthClientId,
        client_secret: env.oauthClientSecret,
        code,
        redirect_uri: env.oauthRedirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      return apiError("Failed to exchange authorization code with GitHub.", 502);
    }

    const tokenData = await tokenResponse.json() as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (tokenData.error || !tokenData.access_token) {
      return apiError(
        tokenData.error_description ?? tokenData.error ?? "GitHub did not return an access token.",
        400,
      );
    }

    const accessToken = tokenData.access_token;

    // Fetch GitHub user identity using the access token
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!userResponse.ok) {
      return apiError("Failed to fetch GitHub user information.", 502);
    }

    const userData = await userResponse.json() as {
      id: number;
      login: string;
      avatar_url?: string;
    };

    const githubUserId = userData.id;
    const githubLogin = userData.login;

    // Check if another wallet already owns this GitHub account
    const existingWallet = await findWalletByGithubUserId(githubUserId);
    if (existingWallet && !addressesEqual(existingWallet, walletAddress)) {
      return apiError(
        `This GitHub account (@${githubLogin}) is already linked to a different Aven wallet.`,
        409,
      );
    }

    // Store the identity record (access token is NOT stored — used only above)
    const now = new Date().toISOString();
    await putIdentityWithIndex({
      walletAddress,
      githubUserId,
      githubLogin,
      avatarUrl: userData.avatar_url,
      linkedAt: existingWallet ? now : now, // preserve original linkedAt in a real update
      updatedAt: now,
    });

    // Redirect to user profile
    return NextResponse.redirect(
      new URL(`/profile/${walletAddress}`, request.url).toString(),
    );
  } catch (error) {
    return apiError(error);
  }
}
