"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getAttestation, verifyAttestation, AttestationObject } from "@/lib/stellar";

const CATEGORY_COLORS: Record<string, string> = {
  Freelance: "#8b5cf6",
  Salary: "#06b6d4",
  Bounty: "#f97316",
  Grant: "#10b981",
  AgentTask: "#ec4899",
  Subscription: "#64748b",
};

export default function VerifyAttestationPage() {
  const params = useParams();
  const attestationId = params.attestation_id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{ verified: boolean; record: AttestationObject | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attestationId) return;
    setLoading(true);
    setError(null);
    Promise.all([verifyAttestation(attestationId), getAttestation(attestationId)])
      .then(([verified, record]) => setResult({ verified, record }))
      .catch((e) => setError(e?.message ?? "Verification failed"))
      .finally(() => setLoading(false));
  }, [attestationId]);

  const truncate = (s: string) => s.slice(0, 8) + "…" + s.slice(-6);

  if (loading) {
    return (
      <div className="dash-loading">
        <div className="dash-spinner" />
        <span>Verifying attestation #{attestationId}…</span>
      </div>
    );
  }

  return (
    <div className="verify-wrap">
      <div className="verify-header">
        <button className="stream-back-btn" onClick={() => router.push("/verify")}>
          ← Back to Verify
        </button>
        <h1 className="verify-title">Attestation #{attestationId}</h1>
        <p className="verify-sub">On-chain verification result read directly from the Attestation contract.</p>
      </div>

      {error && <div className="form-error">{error}</div>}

      {result && (
        <div className={`verify-result-card ${result.verified ? "verify-result--valid" : "verify-result--invalid"}`}>
          <div className="verify-result-badge">
            {result.verified
              ? "✅ Verified — Authentic On-Chain Record"
              : "❌ Not Found — Invalid Attestation"}
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
                  <div className="verify-record-label">Amount Paid</div>
                  <div className="verify-record-value">
                    {result.record.amountPaid.toFixed(4)} {result.record.asset}
                  </div>
                </div>
                <div className="verify-record-item">
                  <div className="verify-record-label">Stream ID</div>
                  <div className="verify-record-value">
                    <Link href={`/stream/${result.record.streamId}`}>#{result.record.streamId}</Link>
                  </div>
                </div>
                <div className="verify-record-item">
                  <div className="verify-record-label">Checkpoint</div>
                  <div className="verify-record-value">#{result.record.checkpointIndex}</div>
                </div>
                <div className="verify-record-item">
                  <div className="verify-record-label">Period</div>
                  <div className="verify-record-value">
                    {result.record.periodStartLedger.toLocaleString()} → {result.record.periodEndLedger.toLocaleString()}
                  </div>
                </div>
                <div className="verify-record-item">
                  <div className="verify-record-label">Client Confirmed</div>
                  <div className="verify-record-value">{result.record.clientConfirmed ? "Yes" : "No"}</div>
                </div>
              </div>

              <div className="verify-addresses">
                <div className="stream-addr-row">
                  <span className="stream-addr-label">Sender</span>
                  <code className="stream-addr-value">{truncate(result.record.sender)}</code>
                  <Link href={`/profile/${result.record.sender}`} className="verify-profile-link">
                    View Profile →
                  </Link>
                </div>
                <div className="stream-addr-row">
                  <span className="stream-addr-label">Recipient</span>
                  <code className="stream-addr-value">{truncate(result.record.recipient)}</code>
                  <Link href={`/profile/${result.record.recipient}`} className="verify-profile-link">
                    View Profile →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
