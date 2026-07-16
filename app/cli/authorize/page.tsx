"use client";

import { useEffect, useState } from "react";
import { signMessage } from "@stellar/freighter-api";
import { useWallet } from "@/components/WalletProvider";

export default function CliAuthorizePage() {
  const { address, connected, connect, connecting } = useWallet();
  const [deviceCode, setDeviceCode] = useState("");
  const [status, setStatus] = useState<"ready" | "signing" | "authorized">("ready");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDeviceCode(new URLSearchParams(window.location.search).get("deviceCode") ?? "");
  }, []);

  async function authorize() {
    if (!connected || !address) return connect();
    if (!deviceCode) return setError("The device code is missing.");
    setStatus("signing");
    setError(null);
    try {
      const message = `Authorize Aven CLI access for device ${deviceCode}`;
      const result = await signMessage(message, { address });
      if (result.error || !result.signedMessage) {
        throw new Error(result.error?.message ?? "The wallet did not return a signature.");
      }
      const signature = typeof result.signedMessage === "string"
        ? result.signedMessage
        : Buffer.from(result.signedMessage).toString("base64");
      const response = await fetch("/api/cli/auth/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceCode, walletAddress: address, signature, message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Authorization failed.");
      setStatus("authorized");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("ready");
    }
  }

  return (
    <div className="create-stream-wrap">
      <div className="create-stream-header">
        <span className="mono-text">CLI / DEVICE AUTHORIZATION</span>
        <h1 className="create-stream-title">Connect this project to Aven.</h1>
        <p className="create-stream-sub">
          This grants a short-lived worker token. It cannot create streams, approve payments, or act as a client.
        </p>
      </div>

      <div className="create-stream-form">
        <div className="form-section">
          <span className="form-label">Device code</span>
          <code className="form-input form-input--mono">{deviceCode || "Missing device code"}</code>
        </div>
        {error && <div className="form-error">{error}</div>}
        {status === "authorized" ? (
          <div className="form-success-banner">CLI access authorized. You can return to the terminal.</div>
        ) : (
          <button className="form-btn" onClick={authorize} disabled={connecting || status === "signing"}>
            {!connected ? "Connect Freighter" : status === "signing" ? "Waiting for signature…" : "Authorize Aven CLI"}
          </button>
        )}
      </div>
    </div>
  );
}
