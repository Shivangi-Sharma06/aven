"use client";

import { useState } from "react";
import { getStreamClient, STREAM_CONTRACT_ID } from "@/lib/contracts";

export default function SetVerifierPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const VERIFIER_PUBLIC_KEY = "GDDOSF2DPZOZ7CNOIHD2LGR5KVNCYH7IIHHE64GXLSHL22ANUEFXJRNM";

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

  async function handleSetVerifier() {
    if (!address) return;
    setLoading(true);
    setStatus(`Calling set_verifier with admin=${address}, verifier=${VERIFIER_PUBLIC_KEY}...`);
    try {
      const client = getStreamClient(address);
      const tx = await client.set_verifier({
        admin: address,
        verifier: VERIFIER_PUBLIC_KEY,
      });
      await tx.signAndSend();
      setStatus(`✅ set_verifier succeeded! Verifier ${VERIFIER_PUBLIC_KEY} is now registered. You can close this page.`);
    } catch (e: any) {
      setStatus(`❌ Failed: ${e.message}. Make sure you're connected as the admin account (GB4MD3RT...).`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "100px auto", padding: 20, fontFamily: "monospace" }}>
      <h1>Set Verifier</h1>
      <p style={{ marginBottom: 20 }}>
        Registers the AVEN_VERIFIER_SECRET key ({VERIFIER_PUBLIC_KEY}) on the stream contract
        ({STREAM_CONTRACT_ID}).
      </p>
      <p style={{ marginBottom: 20 }}>
        You must connect Freighter as the admin account (<strong>GB4MD3RT...</strong>).
      </p>
      {!address ? (
        <button onClick={handleConnect} style={btnStyle}>
          Connect Freighter
        </button>
      ) : (
        <>
          <p>Connected: <code>{address}</code></p>
          {address !== "GB4MD3RT672F6VNAS5C3QECVDTWTJ5RO4Z6PNZUQFPRZQQOZO33TGTMZ" ? (
            <p style={{ color: "red" }}>
              ⚠ This account ({address}) does not match the admin expected
              (GB4MD3RT...). Switch to the admin account in Freighter.
            </p>
          ) : (
            <button onClick={handleSetVerifier} disabled={loading} style={btnStyle}>
              {loading ? "Submitting..." : "Set Verifier"}
            </button>
          )}
        </>
      )}
      {status && <pre style={{ marginTop: 20, padding: 10, background: "#f5f5f5", border: "1px solid #ddd" }}>{status}</pre>}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "12px 24px",
  fontSize: 16,
  cursor: "pointer",
  background: "#6366f1",
  color: "white",
  border: "none",
  borderRadius: 8,
};