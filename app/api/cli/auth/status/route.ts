import { NextResponse } from "next/server";
import { getDeviceAuthorization } from "@/lib/cli-auth-store";
import { apiError } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const deviceCode = new URL(request.url).searchParams.get("deviceCode") ?? "";
  const device = await getDeviceAuthorization(deviceCode);
  if (!device) return apiError("Device authorization was not found.", 404);
  if (Date.parse(device.expiresAt) <= Date.now()) return apiError("Device authorization has expired.", 410);
  return NextResponse.json(
    device.status === "authorized"
      ? { status: "authorized", token: device.token, walletAddress: device.walletAddress }
      : { status: "pending" },
  );
}
