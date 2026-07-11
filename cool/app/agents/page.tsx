"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/components/WalletProvider";
import { computeScore, verifyClaim, ScoreBreakdown } from "@/lib/stellar";

type AgentEntry = {
  address: string;
  score: ScoreBreakdown | null;
  loading: boolean;
};

// Known agents on testnet - can be extended
const KNOWN_AGENT_ADDRESSES: string[] = [];

export default function AgentsPage() {
  const { connected, address, openConnectModal } = useWallet();
  const router = useRouter();
  const [searchAddr, setSearchAddr] = useState("");
  const [searchResult, setSearchResult] = useState<AgentEntry | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [minScore, setMinScore] = useState("100");
  const [claimResult, setClaimResult] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const addr = searchAddr.trim();
    if (!addr) return;
    setSearchLoading(true);
    setError(null);
    setClaimResult(null);
    try {
      const score = await computeScore(addr);
      setSearchResult({ address: addr, score, loading: false });
    } catch (e: any) {
      setError(e?.message ?? "Failed to load reputation");
      setSearchResult(null);
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleVerifyClaim() {
    if (!searchResult?.address) return;
    setClaimLoading(true);
    setError(null);
    try {
      const result = await verifyClaim(searchResult.address, parseFloat(minScore));
      setClaimResult(result);
    } catch (e: any) {
      setError(e?.message ?? "Claim check failed");
    } finally {
      setClaimLoading(false);
    }
  }

  const score = searchResult?.score;

  return (
    <div className="agents-wrap">
      <div className="agents-header">
        <h1 className="agents-title">Reputation Lookup</h1>
        <p className="agents-sub">
          Look up any Stellar address to see their on-chain reputation score computed from completed stream attestations.
        </p>
      </div>

      {/* My score quick-link */}
      {connected && address && (
        <div className="agents-own-banner">
          <span>View your own reputation →</span>
          <button
            className="form-btn-secondary"
            onClick={() => router.push(`/profile/${address}`)}
            id="agents-my-profile"
          >
            My Profile
          </button>
        </div>
      )}

      {/* Search */}
      <form className="agents-search-form" onSubmit={handleSearch} id="reputation-search-form">
        <input
          className="form-input form-input--mono"
          placeholder="Stellar address (G…)"
          value={searchAddr}
          onChange={(e) => setSearchAddr(e.target.value)}
          required
          id="reputation-address-input"
        />
        <button
          className="form-btn"
          type="submit"
          disabled={searchLoading}
          id="reputation-search-btn"
        >
          {searchLoading ? <span className="form-spinner" /> : "Look Up Score"}
        </button>
      </form>

      {error && <div className="form-error">{error}</div>}

      {searchResult && score && (
        <div className="agents-result-card">
          <div className="agents-result-header">
            <code className="profile-address agents-result-addr">
              {searchResult.address.slice(0, 8)}…{searchResult.address.slice(-6)}
            </code>
            <div className="agents-score-chip">
              <span className="agents-score-num">{score.total.toFixed(0)}</span>
              <span className="agents-score-label">Total Score</span>
            </div>
          </div>

          <div className="score-breakdown">
            {[
              { label: "Freelance", value: score.freelance, color: "#8b5cf6" },
              { label: "Salary", value: score.salary, color: "#06b6d4" },
              { label: "Bounty", value: score.bounty, color: "#f97316" },
              { label: "Grant", value: score.grant, color: "#10b981" },
              { label: "Agent Task", value: score.agentTask, color: "#ec4899" },
              { label: "Subscription", value: score.subscription, color: "#64748b" },
            ].map((item) => {
              const maxVal = Math.max(score.total, 1);
              return (
                <div key={item.label} className="score-row">
                  <span className="score-row-label" style={{ color: item.color }}>{item.label}</span>
                  <div className="score-bar-track">
                    <div
                      className="score-bar-fill"
                      style={{ width: `${(item.value / maxVal) * 100}%`, background: item.color }}
                    />
                  </div>
                  <span className="score-row-value">{item.value.toFixed(2)}</span>
                </div>
              );
            })}
          </div>

          {/* Verify claim section */}
          <div className="agents-claim-section">
            <h4 className="agents-claim-title">Verify Minimum Score Claim</h4>
            <p className="agents-claim-sub">
              Check if this address meets a minimum reputation threshold (calls the Reputation contract's <code>verify_claim</code>).
            </p>
            <div className="agents-claim-row">
              <input
                className="form-input agents-claim-input"
                type="number"
                min="0"
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                placeholder="Minimum score"
                id="claim-min-score"
              />
              <button
                className="form-btn-secondary"
                onClick={handleVerifyClaim}
                disabled={claimLoading}
                id="verify-claim-btn"
              >
                {claimLoading ? <span className="form-spinner" /> : "Verify Claim"}
              </button>
            </div>
            {claimResult !== null && (
              <div className={`agents-claim-result ${claimResult ? "agents-claim-result--pass" : "agents-claim-result--fail"}`}>
                {claimResult
                  ? `✅ This address meets the minimum score of ${minScore}`
                  : `❌ This address does NOT meet the minimum score of ${minScore}`}
              </div>
            )}
          </div>

          <div className="agents-result-actions">
            <button
              className="form-btn"
              onClick={() => router.push(`/profile/${searchResult.address}`)}
              id="view-full-profile-btn"
            >
              View Full Profile →
            </button>
          </div>
        </div>
      )}

      {/* How scoring works */}
      <div className="verify-howto">
        <h3 className="verify-howto-title">How Reputation Scoring Works</h3>
        <div className="verify-howto-steps">
          <div className="verify-step">
            <span className="verify-step-num">1</span>
            <div>The Reputation contract reads all attestations for an address from the Attestation contract in real time.</div>
          </div>
          <div className="verify-step">
            <span className="verify-step-num">2</span>
            <div>Each completed stream earns category-weighted points based on total amount paid and category multipliers.</div>
          </div>
          <div className="verify-step">
            <span className="verify-step-num">3</span>
            <div>Scores are never cached on-chain — they always reflect the current attestation state, so they can never be frozen.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
