"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/components/WalletProvider";
import { ATTESTATION_CONTRACT_ID, STREAM_CONTRACT_ID } from "@/lib/contracts";
import { initAttestationContract } from "@/lib/stellar";

export default function RegisterIssuerPage() {
  const { connected, address, openConnectModal } = useWallet();
  const router = useRouter();
  const [adminAddress, setAdminAddress] = useState(address ?? "");
  const [streamContract, setStreamContract] = useState<string>(STREAM_CONTRACT_ID);
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
    if (!streamContract.trim().startsWith("C")) {
      setError("Stream contract address must be a valid contract address");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await initAttestationContract(adminAddress.trim(), streamContract.trim());
      setSuccess(true);
    } catch (e: any) {
      setError(e?.message ?? "Attestation contract initialization failed");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="form-success-wrap">
        <div className="form-success-icon">🪪</div>
        <h2>Attestation Contract Initialized</h2>
        <p className="form-success-sub">The attestation contract now recognizes the stream contract as its caller.</p>
        <div className="form-success-detail">
          <div className="form-detail-row">
            <span className="form-detail-label">Attestation Contract</span>
            <span className="form-detail-value">{ATTESTATION_CONTRACT_ID}</span>
          </div>
          <div className="form-detail-row">
            <span className="form-detail-label">Stream Contract</span>
            <span className="form-detail-value">{streamContract}</span>
          </div>
        </div>
        <div className="form-success-actions">
          <button className="form-btn" onClick={() => router.push("/dashboard")}>Go to Dashboard</button>
          <button className="form-btn-secondary" onClick={() => router.push("/register-sender")}>Initialize Stream</button>
        </div>
      </div>
    );
  }

  return (
    <div className="create-stream-wrap">
      <div className="create-stream-header">
        <h1 className="create-stream-title">Initialize Attestation Contract</h1>
        <p className="create-stream-sub">
          Bind the attestation contract to the stream contract using the current binding targets.
        </p>
      </div>

      {!connected && (
        <div className="create-connect-banner">
          <span>Connect your wallet to initialize on-chain contracts</span>
          <button className="wallet-btn" onClick={openConnectModal} id="init-attestation-connect-wallet">
            Connect Freighter
          </button>
        </div>
      )}

      <form className="create-stream-form" onSubmit={handleSubmit} id="init-attestation-form">
        <div className="form-section">
          <label className="form-label">Admin Address</label>
          <input
            className="form-input form-input--mono"
            value={adminAddress}
            onChange={(e) => setAdminAddress(e.target.value)}
            placeholder="G…"
            id="init-attestation-admin"
          />
        </div>

        <div className="form-section">
          <label className="form-label">Stream Contract Address</label>
          <input
            className="form-input form-input--mono"
            value={streamContract}
            onChange={(e) => setStreamContract(e.target.value)}
            placeholder="C…"
            id="init-attestation-stream"
          />
        </div>

        <div className="form-rate-preview">
          <span>Current binding target: {ATTESTATION_CONTRACT_ID}</span>
        </div>

        {error && <div className="form-error">{error}</div>}

        <button className="form-submit-btn" type="submit" disabled={loading || !connected} id="init-attestation-submit">
          {loading ? <span className="form-spinner" /> : "Initialize Attestation Contract"}
        </button>
      </form>
    </div>
  );
}
