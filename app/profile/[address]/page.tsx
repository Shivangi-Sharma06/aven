"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@/components/WalletProvider";
import { computeScore, getWorkerAttestations, ScoreBreakdown, AttestationObject } from "@/lib/stellar";

const CATEGORY_COLORS: Record<string, string> = {
  Freelance: "#8b5cf6",
  Salary: "#06b6d4",
  Bounty: "#f97316",
  Grant: "#10b981",
  AgentTask: "#ec4899",
  Subscription: "#64748b",
};

export default function ProfilePage() {
  const params = useParams();
  const routerAddress = params.address as string;
  const { address: walletAddress, connected, openConnectModal } = useWallet();
  const router = useRouter();

  // "me" is a special token meaning "my own wallet"
  const address =
    routerAddress === "me"
      ? walletAddress ?? ""
      : routerAddress || walletAddress || "";
  const isOwn = walletAddress && walletAddress.toLowerCase() === address.toLowerCase();


  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [attestations, setAttestations] = useState<AttestationObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    Promise.all([computeScore(address), getWorkerAttestations(address)])
      .then(([s, a]) => {
        setScore(s);
        setAttestations(a.filter((record) => record.kind !== "StreamCompletion"));
      })
      .catch((e) => setError(e?.message ?? "Failed to load profile"))
      .finally(() => setLoading(false));
  }, [address]);

  if (!address) {
    return (
      <div className="dash-empty-state">
        <div className="dash-empty-icon">👤</div>
        <h2>Connect Wallet to View Profile</h2>
        <p>Your reputation score and attestations are loaded from on-chain data.</p>
        <button className="dash-connect-btn" onClick={openConnectModal} id="profile-connect-wallet">
          Connect Freighter
        </button>
      </div>
    );
  }

  const truncate = (addr: string) => addr.slice(0, 8) + "…" + addr.slice(-6);

  const breakdown = score
    ? [
        { label: "Freelance", value: score.freelance },
        { label: "Salary", value: score.salary },
        { label: "Bounty", value: score.bounty },
        { label: "Grant", value: score.grant },
        { label: "Agent Task", value: score.agentTask },
        { label: "Subscription", value: score.subscription },
      ]
    : [];

  const maxVal = breakdown.length > 0 ? Math.max(...breakdown.map((b) => b.value), 1) : 1;

  return (
    <div className="profile-wrap">
      {/* Header */}
      <div className="profile-header">
        <div className="profile-avatar">
          {address.slice(0, 2)}
        </div>
        <div className="profile-header-info">
          <code className="profile-address">{truncate(address)}</code>
          <div className="profile-network-badge">Stellar Testnet</div>
          {isOwn && (
            <button
              className="profile-copy-btn"
              onClick={() => navigator.clipboard.writeText(address)}
              id="profile-copy-address"
            >
              Copy Address
            </button>
          )}
        </div>
        {score && (
          <div className="profile-score-ring">
            <div className="profile-score-value">{score.total.toFixed(0)}</div>
            <div className="profile-score-label">Reputation Score</div>
          </div>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <div className="dash-loading">
          <div className="dash-spinner" />
          <span>Loading on-chain reputation…</span>
        </div>
      ) : (
        <>
          {/* Score breakdown */}
          {score && (
            <div className="profile-section">
              <h3 className="profile-section-title">Reputation Breakdown</h3>
              <div className="score-breakdown">
                {breakdown.map((b) => (
                  <div key={b.label} className="score-row">
                    <span
                      className="score-row-label"
                      style={{ color: CATEGORY_COLORS[b.label.replace(" ", "")] ?? "#888" }}
                    >
                      {b.label}
                    </span>
                    <div className="score-bar-track">
                      <div
                        className="score-bar-fill"
                        style={{
                          width: `${(b.value / maxVal) * 100}%`,
                          background: CATEGORY_COLORS[b.label.replace(" ", "")] ?? "#6366f1",
                        }}
                      />
                    </div>
                    <span className="score-row-value">{b.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attestations */}
          <div className="profile-section">
            <h3 className="profile-section-title">
              Work Attestations ({attestations.length})
            </h3>
            {attestations.length === 0 ? (
              <div className="profile-empty">
                <p>No attestations minted yet. Complete a stream to earn one.</p>
              </div>
            ) : (
              <div className="attestation-list">
                {attestations.map((att) => (
                  <AttestationCard
                    key={att.id}
                    attestation={att}
                    onView={() => router.push(`/verify?id=${att.id}`)}
                  />
                ))}
              </div>
            )}
          </div>

          {isOwn && (
            <div className="profile-actions">
              <button
                className="form-btn"
                onClick={() => router.push("/stream/create")}
                id="profile-create-stream"
              >
                + Create Stream
              </button>
              <button
                className="form-btn-secondary"
                onClick={() => router.push("/dashboard")}
                id="profile-go-dashboard"
              >
                View Dashboard
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AttestationCard({ attestation, onView }: { attestation: AttestationObject; onView: () => void }) {
  const kindLabel =
    attestation.kind === "WorkSession" ? "Work Session"
    : attestation.kind === "LegacyReviewed" ? "Legacy"
    : attestation.kind === "StreamCompletion" ? "Project Completion"
    : "Checkpoint";
  return (
    <div className="attestation-card" onClick={onView}>
      <div className="attestation-card-header">
        <span
          className="stream-cat-badge"
          style={{ background: CATEGORY_COLORS[attestation.category] ?? "#6366f1" }}
        >
          {attestation.category}
        </span>
        <span
          className="stream-cat-badge"
          style={{ background: attestation.clientConfirmed ? "#10b981" : "#64748b", fontSize: "0.7rem" }}
        >
          {kindLabel}{attestation.autoReleased ? " (auto)" : ""}
        </span>
        <span className="attestation-id">#{attestation.id}</span>
      </div>
      <div className="attestation-title">{attestation.title}</div>
      <div className="attestation-meta">
        <span>{attestation.amountPaid.toFixed(2)} {attestation.asset}</span>
        <span
          title="Stellar ledger sequence numbers representing the on-chain verification window — not an XLM amount"
        >
          Verified on ledgers {attestation.startLedger.toLocaleString()}–{attestation.endLedger.toLocaleString()}
        </span>
      </div>
      <div className="attestation-verified-badge">✓ On-Chain Verified</div>
    </div>
  );
}
