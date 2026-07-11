"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@/components/WalletProvider";
import {
  getStream,
  computeEarned,
  pauseStream,
  resumeStream,
  cancelStream,
  withdrawEarned,
  StreamObject,
} from "@/lib/stellar";

const STATUS_LABELS: Record<string, string> = {
  active: "🟢 Active",
  paused: "🟡 Paused",
  completed: "✅ Completed",
  cancelled: "🔴 Cancelled",
};

export default function StreamDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { address, connected } = useWallet();

  const [stream, setStream] = useState<StreamObject | null>(null);
  const [earned, setEarned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    setLoading(true);
    try {
      const s = await getStream(id, address ?? undefined);
      setStream(s);
      if (s?.status === "active" || s?.status === "paused") {
        const e = await computeEarned(id, address ?? undefined);
        setEarned(e);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load stream");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Poll earned every 6 seconds when active
    pollRef.current = setInterval(async () => {
      if (stream?.status === "active") {
        const e = await computeEarned(id, address ?? undefined);
        setEarned(e);
      }
    }, 6000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, address]);

  async function doAction(action: string) {
    if (!address) return;
    setActionLoading(action);
    setError(null);
    setTxResult(null);
    try {
      if (action === "pause") await pauseStream(id, address);
      if (action === "resume") await resumeStream(id, address);
      if (action === "cancel") await cancelStream(id, address);
      if (action === "withdraw") {
        const res = await withdrawEarned(id, address);
        setTxResult(`Withdrew ${res.amount.toFixed(4)} ${stream?.asset} · tx: ${res.txHash.slice(0, 10)}…`);
      }
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Transaction failed");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="stream-detail-loading">
        <div className="dash-spinner" />
        <span>Loading stream #{id}…</span>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="stream-detail-empty">
        <h2>Stream Not Found</h2>
        <p>No stream with ID #{id} exists on-chain.</p>
        <button className="form-btn" onClick={() => router.push("/dashboard")}>← Dashboard</button>
      </div>
    );
  }

  const isSender = address && stream.sender.toLowerCase() === address.toLowerCase();
  const isRecipient = address && stream.recipient.toLowerCase() === address.toLowerCase();
  const pct = stream.totalDeposited > 0
    ? Math.min(100, (stream.totalWithdrawn / stream.totalDeposited) * 100)
    : 0;

  return (
    <div className="stream-detail-wrap">
      <div className="stream-detail-nav">
        <button className="stream-back-btn" onClick={() => router.push("/dashboard")}>← Back</button>
        <span className="stream-detail-id">Stream #{id}</span>
      </div>

      {error && <div className="form-error">{error}</div>}
      {txResult && <div className="form-success-banner">{txResult}</div>}

      <div className="stream-detail-card">
        <div className="stream-detail-header">
          <div>
            <h1 className="stream-detail-title">{stream.title}</h1>
            <div className="stream-detail-meta">
              <span className="stream-cat-badge" style={{ background: "#6366f1" }}>{stream.category}</span>
              <span className="stream-asset-badge">{stream.asset}</span>
            </div>
          </div>
          <div className="stream-detail-status">{STATUS_LABELS[stream.status]}</div>
        </div>

        {/* Progress */}
        <div className="stream-detail-progress-wrap">
          <div className="stream-detail-progress-bar">
            <div className="stream-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="stream-detail-progress-labels">
            <span>{stream.totalWithdrawn.toFixed(4)} withdrawn</span>
            <span>{stream.totalDeposited.toFixed(2)} total</span>
          </div>
        </div>

        {/* Live earned */}
        {(stream.status === "active" || stream.status === "paused") && (
          <div className="stream-detail-earned-wrap">
            <div className="stream-detail-earned-label">Withdrawable now</div>
            <div className="stream-detail-earned-value">
              {earned.toFixed(6)} <span className="stream-detail-earned-asset">{stream.asset}</span>
            </div>
          </div>
        )}

        {/* Addresses */}
        <div className="stream-detail-addresses">
          <div className="stream-addr-row">
            <span className="stream-addr-label">Sender</span>
            <code className="stream-addr-value">{stream.sender}</code>
          </div>
          <div className="stream-addr-row">
            <span className="stream-addr-label">Recipient</span>
            <code className="stream-addr-value">{stream.recipient}</code>
          </div>
        </div>

        {/* Info grid */}
        <div className="stream-detail-grid">
          <div className="stream-detail-item">
            <div className="stream-detail-item-label">Rate / ledger</div>
            <div className="stream-detail-item-value">{stream.ratePerLedger.toFixed(7)} {stream.asset}</div>
          </div>
          <div className="stream-detail-item">
            <div className="stream-detail-item-label">Duration (ledgers)</div>
            <div className="stream-detail-item-value">{stream.durationLedgers.toLocaleString()}</div>
          </div>
          <div className="stream-detail-item">
            <div className="stream-detail-item-label">Start Ledger</div>
            <div className="stream-detail-item-value">#{stream.startLedger.toLocaleString()}</div>
          </div>
          <div className="stream-detail-item">
            <div className="stream-detail-item-label">Attestation</div>
            <div className="stream-detail-item-value">
              {stream.hasAttestation ? `#${stream.attestationId}` : "Not minted yet"}
            </div>
          </div>
        </div>

        {/* Actions */}
        {connected && (
          <div className="stream-detail-actions">
            {isSender && stream.status === "active" && (
              <button
                className="stream-action-btn stream-action-btn--warn"
                onClick={() => doAction("pause")}
                disabled={!!actionLoading}
                id="stream-pause-btn"
              >
                {actionLoading === "pause" ? "…" : "Pause Stream"}
              </button>
            )}
            {isSender && stream.status === "paused" && (
              <button
                className="stream-action-btn stream-action-btn--success"
                onClick={() => doAction("resume")}
                disabled={!!actionLoading}
                id="stream-resume-btn"
              >
                {actionLoading === "resume" ? "…" : "Resume Stream"}
              </button>
            )}
            {isSender && (stream.status === "active" || stream.status === "paused") && (
              <button
                className="stream-action-btn stream-action-btn--danger"
                onClick={() => doAction("cancel")}
                disabled={!!actionLoading}
                id="stream-cancel-btn"
              >
                {actionLoading === "cancel" ? "…" : "Cancel Stream"}
              </button>
            )}
            {isRecipient && (stream.status === "active" || stream.status === "paused") && (
              <button
                className="stream-action-btn stream-action-btn--primary"
                onClick={() => doAction("withdraw")}
                disabled={!!actionLoading}
                id="stream-withdraw-btn"
              >
                {actionLoading === "withdraw" ? "…" : "Withdraw Earned"}
              </button>
            )}
          </div>
        )}

        {/* Explorer link */}
        <a
          className="stream-explorer-link"
          href={`https://stellar.expert/explorer/testnet/contract/${stream.sender}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on Stellar Expert ↗
        </a>
      </div>
    </div>
  );
}
