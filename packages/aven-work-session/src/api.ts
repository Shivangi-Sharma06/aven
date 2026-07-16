import type { AvenConfig, WorkSessionReport } from "./types.js";

async function responseJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error ?? `Aven API returned ${response.status}.`);
  return data;
}

export async function requestDeviceAuthorization(dashboardUrl: string) {
  const response = await fetch(`${dashboardUrl}/api/cli/auth/request`, { method: "POST" });
  return responseJson(response) as Promise<{ deviceCode: string; verificationUrl: string; expiresAt: string }>;
}

export async function pollDeviceAuthorization(dashboardUrl: string, deviceCode: string) {
  const response = await fetch(`${dashboardUrl}/api/cli/auth/status?deviceCode=${encodeURIComponent(deviceCode)}`);
  if (response.status === 410) throw new Error("CLI authorization expired.");
  return responseJson(response) as Promise<{ status: "pending" | "authorized"; token?: string; walletAddress?: string }>;
}

export async function inspectStream(
  dashboardUrl: string,
  streamId: string,
  token: string,
) {
  const response = await fetch(`${dashboardUrl}/api/streams/${encodeURIComponent(streamId)}/work-sessions`, {
    headers: { authorization: `Bearer ${token}` },
  });
  await responseJson(response);
  return {
    asset: response.headers.get("x-aven-stream-asset") as "USDC" | "XLM",
    status: response.headers.get("x-aven-stream-status") ?? "",
    workerAddress: response.headers.get("x-aven-worker-address") ?? "",
    earned: response.headers.get("x-aven-earned") ?? "0.0000000",
  };
}

export async function submitReport(config: AvenConfig, report: WorkSessionReport) {
  const response = await fetch(`${config.dashboardUrl}/api/work-sessions/submit`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(report),
  });
  return responseJson(response) as Promise<{ sessionId: string; status: string }>;
}
