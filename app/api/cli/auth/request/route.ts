import { NextResponse } from "next/server";
import { createDeviceAuthorization } from "@/lib/cli-auth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const device = await createDeviceAuthorization();
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    deviceCode: device.deviceCode,
    verificationUrl: `${origin}/cli/authorize?deviceCode=${device.deviceCode}`,
    expiresAt: device.expiresAt,
  });
}
