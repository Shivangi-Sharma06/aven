"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/components/WalletProvider";
import { STREAM_CONTRACT_ID, ATTESTATION_CONTRACT_ID } from "@/lib/contracts";
import { initStreamContract } from "@/lib/stellar";

export default function RegisterSenderPage() {
  const { connected, address, openConnectModal } = useWallet();
  const router = useRouter();
  const [adminAddress, setAdminAddress] = useState(address ?? "");
  const [attestationContract, setAttestationContract] = useState<string>(ATTESTATION_CONTRACT_ID);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (address) setAdminAddress(address);
  }, [address]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!connected || !address) {
      openConnectModal();
      return;
    }

    if (!adminAddress.trim().startsWith("G")) {
      setError("Admin address must be a valid Stellar account address");
      return;
    }
    if (!attestationContract.trim().startsWith("C")) {
      setError("Attestation contract address must be a valid contract address");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await initStreamContract(adminAddress.trim(), attestationContract.trim());
      setSuccess(true);
    } catch (e: any) {
      setError(e?.message ?? "Stream contract initialization failed");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="form-success-wrap">
        <div className="form-success-icon">🧭</div>
        <h2>Stream Contract Initialized</h2>
        <p className="form-success-sub">The stream contract now points at the attestation contract.</p>
        <div className="form-success-detail">
          <div className="form-detail-row">
            <span className="form-detail-label">Stream Contract</span>
            <span className="form-detail-value">{STREAM_CONTRACT_ID}</span>
          </div>
          <div className="form-detail-row">
            <span className="form-detail-label">Attestation Contract</span>
            <span className="form-detail-value">{attestationContract}</span>
          </div>
        </div>
        <div className="form-success-actions">
          <button className="form-btn" onClick={() => router.push("/dashboard")}>Go to Dashboard</button>
          <button className="form-btn-secondary" onClick={() => router.push("/register-issuer")}>Initialize Attestation</button>
        </div>
      </div>
    );
  }

  return (
    <div className="create-stream-wrap">
      <div className="create-stream-header">
        <h1 className="create-stream-title">Initialize Stream Contract</h1>
        <p className="create-stream-sub">
          Bind the stream contract to the attestation contract using the current binding targets.
        </p>
      </div>

      {!connected && (
        <div className="create-connect-banner">
          <span>Connect your wallet to initialize on-chain contracts</span>
          <button className="wallet-btn" onClick={openConnectModal} id="init-stream-connect-wallet">
            Connect Freighter
          </button>
        </div>
      )}

      <form className="create-stream-form" onSubmit={handleSubmit} id="init-stream-form">
        <div className="form-section">
          <label className="form-label">Admin Address</label>
          <input
            className="form-input form-input--mono"
            value={adminAddress}
            onChange={(e) => setAdminAddress(e.target.value)}
            placeholder="G…"
            id="init-stream-admin"
          />
        </div>

        <div className="form-section">
          <label className="form-label">Attestation Contract Address</label>
          <input
            className="form-input form-input--mono"
            value={attestationContract}
            onChange={(e) => setAttestationContract(e.target.value)}
            placeholder="C…"
            id="init-stream-attestation"
          />
        </div>

        <div className="form-rate-preview">
          <span>Current binding target: {STREAM_CONTRACT_ID}</span>
        </div>

        {error && <div className="form-error">{error}</div>}

        <button className="form-submit-btn" type="submit" disabled={loading || !connected} id="init-stream-submit">
          {loading ? <span className="form-spinner" /> : "Initialize Stream Contract"}
        </button>
      </form>
    </div>
  );
}
