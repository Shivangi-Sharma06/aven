"use client";

import { useEffect, useState } from "react";
import { signMessage } from "@stellar/freighter-api";
import { useWallet } from "@/components/WalletProvider";
import styles from "./page.module.css";

function signatureToBase64(signature: string | Uint8Array) {
  if (typeof signature === "string") return signature;
  let binary = "";
  for (const byte of signature) binary += String.fromCharCode(byte);
  return window.btoa(binary);
}

function authorizationErrorMessage(caught: unknown) {
  if (caught instanceof Error) return caught.message;
  if (caught && typeof caught === "object" && "message" in caught) {
    const message = (caught as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  if (caught instanceof Event) {
    return "Freighter could not complete the signing request. Unlock the wallet and try again.";
  }
  return "Freighter could not complete the authorization request.";
}

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
      if (result.signerAddress && result.signerAddress.toUpperCase() !== address.toUpperCase()) {
        throw new Error("Freighter signed with a different account. Switch to the stream recipient and try again.");
      }
      const signature = signatureToBase64(result.signedMessage);
      const response = await fetch("/api/cli/auth/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceCode, walletAddress: address, signature, message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Authorization failed.");
      setStatus("authorized");
    } catch (caught) {
      setError(authorizationErrorMessage(caught));
      setStatus("ready");
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <span className={styles.eyebrow}>CLI / Device Authorization</span>
        <h1 className={styles.title}>Connect this project to Aven.</h1>
        <p className={styles.subtitle}>
          This grants a short-lived worker token. It cannot create streams, approve payments, or act as a client.
        </p>

        {error && <div className={styles.error}>{error}</div>}

        {status === "authorized" ? (
          <div className={styles.success}>
            <span className={styles.successIcon}>✓</span>
            <span className={styles.successTitle}>Authorization successful</span>
            <p className={styles.successMessage}>You can return to the terminal.</p>
          </div>
        ) : (
          <>
            <span className={styles.deviceCodeLabel}>Device code</span>
            <code className={`${styles.deviceCode}${deviceCode ? "" : ` ${styles["deviceCode--missing"]}`}`}>
              {deviceCode || "Missing device code"}
            </code>
            <button
              id="cli-authorize-btn"
              className={styles.btn}
              onClick={authorize}
              disabled={connecting || status === "signing"}
            >
              {!connected
                ? "Connect Freighter"
                : status === "signing"
                  ? "Waiting for signature…"
                  : "Authorize Aven CLI"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
