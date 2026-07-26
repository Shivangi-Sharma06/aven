"use client";

import { useState, useEffect } from "react";
import { getStreamClient, STREAM_CONTRACT_ID } from "@/lib/contracts";

/**
 * /set-verifier — One-time admin page to register the server's verifier
 * keypair (AVEN_VERIFIER_SECRET) on the stream contract.
 *
 * After calling set_verifier, the server can create WithdrawalRecords
 * via verify_work. Without this step the server falls back to having the
 * recipient submit request_withdrawal directly through Freighter.
 */
export default function SetVerifierPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [verifierPublicKey, setVerifierPublicKey] = useState<string | null>(null);
  const [currentVerifier, setCurrentVerifier] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Fetch the server's verifier public key from the API
  useEffect(() => {
    fetch("/api/verifier-info")
      .then((res) => res.json())
      .then((data) => {
        if (data.verifierPublicKey) setVerifierPublicKey(data.verifierPublicKey);
      })
      .catch(() => {
        // Fallback: if the API isn't available, we can't auto-detect
        setStatus("Could not fetch verifier info from server.");
      });
  }, []);

  async function handleConnect() {
    try {
      const { connectWallet: connect } = await import("@/lib/stellar");
      const result = await connect();
      setAddress(result.address);
      setStatus(`Connected as ${result.address}`);
    } catch (e: any) {
      setStatus(`Connection failed: ${e.message}`);
    }
  }

  async function checkCurrentVerifier() {
    if (!address) return;
    setChecking(true);
    try {
      const client = getStreamClient(address);
      // Try a dry-run of verify_work to see who the contract expects as verifier.
      // We simulate with dummy data just to inspect needsNonInvokerSigningBy.
      const tx = await client.verify_work({
        stream_id: 0n,
        request_id: "__probe__",
        amount: 1n,
        evidence_hash: Buffer.alloc(32),
        active_duration_seconds: 1n,
        work_start_ledger: 0,
      });
      const signers = tx.needsNonInvokerSigningBy();
      if (signers.length > 0) {
        setCurrentVerifier(signers[0]);
      } else {
        setCurrentVerifier("(none — no verifier set)");
      }
    } catch (e: any) {
      // VerifierNotConfigured (error 31) means no verifier is set
      const msg = e?.message ?? String(e);
      if (msg.includes("31") || msg.includes("VerifierNotConfigured") || msg.includes("NotConfigured")) {
        setCurrentVerifier("(none — no verifier configured on contract)");
      } else if (msg.includes("8") || msg.includes("StreamNotFound")) {
        // Stream 0 doesn't exist, but that's OK — the verifier check happens before stream lookup
        // in some contract versions, or after. If we get StreamNotFound, verifier might be set.
        setCurrentVerifier("(could not determine — stream 0 not found)");
      } else {
        setCurrentVerifier(`(error probing: ${msg.slice(0, 120)})`);
      }
    } finally {
      setChecking(false);
    }
  }

  async function handleSetVerifier() {
    if (!address || !verifierPublicKey) return;
    setLoading(true);
    setStatus(`Calling set_verifier with admin=${address}, verifier=${verifierPublicKey}...`);
    try {
      const client = getStreamClient(address);
      const tx = await client.set_verifier({
        admin: address,
        verifier: verifierPublicKey,
      });
      await tx.signAndSend();
      setStatus(`✅ set_verifier succeeded! Verifier ${verifierPublicKey} is now registered on the contract. Withdrawals via the server verifier path will now work. You can close this page.`);
      setCurrentVerifier(verifierPublicKey);
    } catch (e: any) {
      setStatus(`❌ Failed: ${e.message}. Make sure you're connected as the contract admin account.`);
    } finally {
      setLoading(false);
    }
  }

  async function handleClearVerifier() {
    // There's no clear_verifier in the contract, so this is informational
    setStatus("ℹ️ The contract does not support clearing the verifier. To use the legacy path (recipient signs request_withdrawal via Freighter), redeploy the contract without calling set_verifier.");
  }

  const alreadyCorrect =
    currentVerifier && verifierPublicKey && currentVerifier === verifierPublicKey;

  return (
    <div style={{ maxWidth: 700, margin: "80px auto", padding: 24, fontFamily: "monospace" }}>
      <h1 style={{ marginBottom: 8 }}>Set Verifier</h1>
      <p style={{ marginBottom: 16, color: "#666", fontSize: 14 }}>
        Registers the server&apos;s AVEN_VERIFIER_SECRET key on the stream contract so the server
        can create on-chain WithdrawalRecords via <code>verify_work</code>.
      </p>

      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <strong>Stream Contract:</strong>{" "}
          <code style={{ fontSize: 12 }}>{STREAM_CONTRACT_ID || "(not configured)"}</code>
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Server Verifier Key:</strong>{" "}
          <code style={{ fontSize: 12 }}>{verifierPublicKey ?? "Loading..."}</code>
        </div>
        <div>
          <strong>On-chain Verifier:</strong>{" "}
          <code style={{ fontSize: 12 }}>{currentVerifier ?? "(connect wallet to check)"}</code>
          {alreadyCorrect && <span style={{ color: "green", marginLeft: 8 }}>✅ Matched</span>}
          {currentVerifier && verifierPublicKey && !alreadyCorrect && currentVerifier.startsWith("G") && (
            <span style={{ color: "red", marginLeft: 8 }}>⚠ Mismatch</span>
          )}
        </div>
      </div>

      {!address ? (
        <button onClick={handleConnect} style={btnStyle}>
          Connect Freighter (Admin Wallet)
        </button>
      ) : (
        <div>
          <p style={{ marginBottom: 12 }}>
            Connected: <code>{address}</code>
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={checkCurrentVerifier}
              disabled={checking}
              style={{ ...btnStyle, background: "#4b5563" }}
            >
              {checking ? "Checking..." : "Check Current Verifier"}
            </button>

            {verifierPublicKey && !alreadyCorrect && (
              <button onClick={handleSetVerifier} disabled={loading} style={btnStyle}>
                {loading ? "Submitting..." : "Set Verifier"}
              </button>
            )}

            {alreadyCorrect && (
              <p style={{ color: "green", padding: "12px 0" }}>
                ✅ The verifier is already correctly set. No action needed.
              </p>
            )}
          </div>

          <button
            onClick={handleClearVerifier}
            style={{ ...btnStyle, background: "#94a3b8", marginTop: 12, fontSize: 13, padding: "8px 16px" }}
          >
            How to use without a verifier?
          </button>
        </div>
      )}

      {status && (
        <pre
          style={{
            marginTop: 20,
            padding: 12,
            background: "#1e1e2e",
            color: "#cdd6f4",
            border: "1px solid #45475a",
            borderRadius: 8,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {status}
        </pre>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "12px 24px",
  fontSize: 15,
  cursor: "pointer",
  background: "#6366f1",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontFamily: "monospace",
};

const cardStyle: React.CSSProperties = {
  padding: 16,
  background: "#f8f9fa",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 14,
  lineHeight: 1.8,
};