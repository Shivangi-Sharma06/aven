import { NextResponse } from "next/server";
import { authorizeDevice, getDeviceAuthorization } from "@/lib/cli-auth-store";
import { apiError } from "@/lib/api-response";
import { getRecipientStreams } from "@/lib/stellar";
import { verifyWalletSignature } from "@/lib/work-session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      deviceCode?: string;
      walletAddress?: string;
      signature?: string;
      message?: string;
    };
    const deviceCode = body.deviceCode?.trim() ?? "";
    const walletAddress = body.walletAddress?.trim() ?? "";
    const expectedMessage = `Authorize Aven CLI access for device ${deviceCode}`;
    const device = await getDeviceAuthorization(deviceCode);
    if (!device) return apiError("Device authorization was not found.", 404);
    if (body.message !== expectedMessage) return apiError("The authorization message is invalid.", 400);
    if (!body.signature || !verifyWalletSignature(walletAddress, expectedMessage, body.signature)) {
      return apiError("The wallet signature could not be verified.", 401);
    }
    const streams = await getRecipientStreams(walletAddress);
    if (!streams.some((stream) => stream.status === "active" || stream.status === "paused")) {
      return apiError("This wallet is not the recipient of an active Aven stream.", 403);
    }
    await authorizeDevice(deviceCode, walletAddress);
    return NextResponse.json({ status: "authorized" });
  } catch (error) {
    return apiError(error);
  }
}
