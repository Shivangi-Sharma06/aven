import open from "open";
import { pollDeviceAuthorization, requestDeviceAuthorization } from "./api.js";

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function authorizeCli(
  dashboardUrl: string,
): Promise<{ status: "authorized"; token: string; walletAddress: string }> {
  const request = await requestDeviceAuthorization(dashboardUrl);
  process.stdout.write(`\nOpen this URL to authorize Aven CLI:\n${request.verificationUrl}\n\n`);
  await open(request.verificationUrl);
  const deadline = Math.min(Date.parse(request.expiresAt), Date.now() + 5 * 60_000);
  while (Date.now() < deadline) {
    const status = await pollDeviceAuthorization(dashboardUrl, request.deviceCode);
    if (status.status === "authorized" && status.token && status.walletAddress) {
      return {
        status: "authorized",
        token: status.token,
        walletAddress: status.walletAddress,
      };
    }
    await delay(2_000);
  }
  throw new Error("CLI authorization timed out after five minutes.");
}
