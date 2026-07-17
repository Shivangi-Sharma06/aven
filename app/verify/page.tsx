"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getAttestation, verifyAttestation, AttestationObject } from "@/lib/stellar";

const CATEGORY_COLORS: Record<string, string> = {
  Freelance: "#8b5cf6",
  Salary: "#06b6d4",
  Bounty: "#f97316",
  Grant: "#10b981",
  AgentTask: "#ec4899",
  Subscription: "#64748b",
};

function VerifyContent() {
  const searchParams = useSearchParams();
  const defaultId = searchParams.get("id") ?? "";

  const [attestationId, setAttestationId] = useState(defaultId);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ verified: boolean; record: AttestationObject | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!attestationId.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const [isValid, record] = await Promise.all([
        verifyAttestation(attestationId.trim()),
        getAttestation(attestationId.trim()),
      ]);
      setResult({ verified: isValid, record });
    } catch (e: any) {
      setError(e?.message ?? "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  const truncate = (s: string) => s.slice(0, 8) + "…" + s.slice(-6);

  return (
    <div className="verify-wrap">
      <div className="verify-header">
        <h1 className="verify-title">Verify Work Attestation</h1>
        <p className="verify-sub">
          Enter an on-chain attestation ID to cryptographically verify a work record on Stellar.
        </p>
      </div>

      <form className="verify-form" onSubmit={handleSearch} id="verify-attestation-form">
        <input
          className="form-input form-input--mono"
          placeholder="Attestation ID (e.g. 1)"
          value={attestationId}
          onChange={(e) => setAttestationId(e.target.value)}
          required
          id="verify-id-input"
        />
        <button
          className="form-btn"
          type="submit"
          disabled={loading}
          id="verify-search-btn"
        >
          {loading ? <span className="form-spinner" /> : "Verify On-Chain"}
        </button>
      </form>

      {error && <div className="form-error">{error}</div>}

      {result && (
        <div className={`verify-result-card ${result.verified ? "verify-result--valid" : "verify-result--invalid"}`}>
          <div className="verify-result-badge">
            {result.verified ? "✅ Verified — Authentic On-Chain Record" : "❌ Not Found — Invalid Attestation"}
          </div>

          {result.record && (
            <div className="verify-record">
              <div className="verify-record-title">{result.record.title}</div>

              <div className="verify-record-grid">
                <div className="verify-record-item">
                  <div className="verify-record-label">Category</div>
                  <div
                    className="stream-cat-badge"
                    style={{ background: CATEGORY_COLORS[result.record.category] ?? "#6366f1" }}
                  >
                    {result.record.category}
                  </div>
                </div>
                <div className="verify-record-item">
                  <div className="verify-record-label">Total Paid</div>
                  <div className="verify-record-value">
                    {result.record.amountPaid.toFixed(4)} {result.record.asset}
                  </div>
                </div>
                <div className="verify-record-item">
                  <div className="verify-record-label">Stream ID</div>
                  <div className="verify-record-value">#{result.record.streamId}</div>
                </div>
                <div className="verify-record-item">
                  <div className="verify-record-label">Minted at ledger</div>
                  <div className="verify-record-value">{result.record.mintedAtLedger.toLocaleString()}</div>
                </div>
              </div>

              <div className="verify-addresses">
                <div className="stream-addr-row">
                  <span className="stream-addr-label">Sender</span>
                  <code className="stream-addr-value">{truncate(result.record.sender)}</code>
                  <a
                    href={`/profile/${result.record.sender}`}
                    className="verify-profile-link"
                  >
                    View Profile →
                  </a>
                </div>
                <div className="stream-addr-row">
                  <span className="stream-addr-label">Recipient</span>
                  <code className="stream-addr-value">{truncate(result.record.recipient)}</code>
                  <a
                    href={`/profile/${result.record.recipient}`}
                    className="verify-profile-link"
                  >
                    View Profile →
                  </a>
                </div>
              </div>

              <a
                className="stream-explorer-link"
                href={`https://stellar.expert/explorer/testnet/contract/${result.record.recipient}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Stellar Expert ↗
              </a>
            </div>
          )}
        </div>
      )}

      {/* How it works */}
      <div className="verify-howto">
        <h3 className="verify-howto-title">How it works</h3>
        <div className="verify-howto-steps">
          <div className="verify-step">
            <span className="verify-step-num">1</span>
            <div>A stream completes on-chain. The Aven Stream contract calls the Attestation contract to mint a permanent record.</div>
          </div>
          <div className="verify-step">
            <span className="verify-step-num">2</span>
            <div>The attestation record contains sender, recipient, category, amount paid, and ledger range — all immutable on Stellar.</div>
          </div>
          <div className="verify-step">
            <span className="verify-step-num">3</span>
            <div>Anyone can verify any attestation ID here — no wallet required. The result is read directly from the contract state.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="dash-loading"><div className="dash-spinner" /> Loading…</div>}>
      <VerifyContent />
    </Suspense>
  );
}
