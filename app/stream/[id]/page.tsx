"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@/components/WalletProvider";
import {
  getStream,
  getCheckpoint,
  computeEarned,
  pauseStream,
  resumeStream,
  cancelStream,
  withdrawEarned,
  submitCheckpoint,
  approveCheckpoint,
  settleCheckpoints,
  hashEvidenceText,
  STREAM_CONTRACT_ID,
  StreamObject,
  CheckpointObject,
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
  const [checkpoints, setCheckpoints] = useState<CheckpointObject[]>([]);
  const [checkpointIndex, setCheckpointIndex] = useState("0");
  const [evidenceHash, setEvidenceHash] = useState("0000000000000000000000000000000000000000000000000000000000000000");
  const [evidenceText, setEvidenceText] = useState("");
  const [hashLoading, setHashLoading] = useState(false);
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
      if (s?.checkpointCount) {
        const records = await Promise.all(
          Array.from({ length: s.checkpointCount }, (_, index) => getCheckpoint(id, index, address ?? undefined))
        );
        setCheckpoints(records.filter(Boolean) as CheckpointObject[]);
      } else {
        setCheckpoints([]);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load stream");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    pollRef.current = setInterval(async () => {
      if (stream?.status === "active") {
        const e = await computeEarned(id, address ?? undefined);
        setEarned(e);
      }
    }, 6000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, address]);

  async function generateEvidenceHash() {
    if (!evidenceText.trim()) {
      setError("Enter evidence text or a deliverable description first");
      return;
    }
    setHashLoading(true);
    setError(null);
    try {
      const hash = await hashEvidenceText(evidenceText);
      setEvidenceHash(hash);
      setTxResult("Evidence hash generated from description");
    } catch (e: any) {
      setError(e?.message ?? "Failed to generate hash");
    } finally {
      setHashLoading(false);
    }
  }

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
      if (action === "submitCheckpoint") {
        await submitCheckpoint(id, address, parseInt(checkpointIndex, 10), evidenceHash.trim());
        setTxResult(`Checkpoint #${checkpointIndex} submitted`);
      }
      if (action === "approveCheckpoint") {
        const attestationId = await approveCheckpoint(id, address, parseInt(checkpointIndex, 10));
        setTxResult(`Checkpoint #${checkpointIndex} approved · attestation #${attestationId}`);
      }
      if (action === "settleCheckpoints") {
        const settled = await settleCheckpoints(id, address);
        setTxResult(`Settled ${settled} checkpoint(s)`);
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
  const hasAttestation = checkpoints.some((checkpoint) => checkpoint.attestationId);

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

        <div className="stream-detail-progress-wrap">
          <div className="stream-detail-progress-bar">
            <div className="stream-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="stream-detail-progress-labels">
            <span>{stream.totalWithdrawn.toFixed(4)} withdrawn</span>
            <span>{stream.totalDeposited.toFixed(2)} total</span>
          </div>
        </div>

        {(stream.status === "active" || stream.status === "paused") && (
          <div className="stream-detail-earned-wrap">
            <div className="stream-detail-earned-label">Withdrawable now</div>
            <div className="stream-detail-earned-value">
              {earned.toFixed(6)} <span className="stream-detail-earned-asset">{stream.asset}</span>
            </div>
          </div>
        )}

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
            <div className="stream-detail-item-label">Checkpoint Count</div>
            <div className="stream-detail-item-value">{stream.checkpointCount}</div>
          </div>
          <div className="stream-detail-item">
            <div className="stream-detail-item-label">Approval Timeout</div>
            <div className="stream-detail-item-value">{stream.approvalTimeoutLedgers} ledgers</div>
          </div>
          <div className="stream-detail-item">
            <div className="stream-detail-item-label">Cap Percent</div>
            <div className="stream-detail-item-value">{stream.withdrawableCapPercent}%</div>
          </div>
          <div className="stream-detail-item">
            <div className="stream-detail-item-label">Attestation Flow</div>
            <div className="stream-detail-item-value">{hasAttestation ? "Minted" : "Pending approval"}</div>
          </div>
          <div className="stream-detail-item">
            <div className="stream-detail-item-label">Paused Duration</div>
            <div className="stream-detail-item-value">{stream.pausedDurationLedgers.toLocaleString()} ledgers</div>
          </div>
        </div>

        <div className="stream-checkpoint-panel">
          <div className="stream-checkpoint-panel-header">
            <h3 className="stream-checkpoint-panel-title">Checkpoint Controls</h3>
            <span className="stream-checkpoint-panel-sub">Submit evidence, approve work, or settle due checkpoints.</span>
          </div>

          <div className="form-row">
            <div className="form-section" style={{ flex: 1 }}>
              <label className="form-label">Checkpoint Index</label>
              <input
                className="form-input form-input--mono"
                type="number"
                min="0"
                max={Math.max(stream.checkpointCount - 1, 0)}
                value={checkpointIndex}
                onChange={(e) => setCheckpointIndex(e.target.value)}
                id="checkpoint-index-input"
              />
            </div>
            <div className="form-section" style={{ flex: 2 }}>
              <label className="form-label">Evidence Description</label>
              <input
                className="form-input"
                placeholder="Deliverable summary or IPFS link"
                value={evidenceText}
                onChange={(e) => setEvidenceText(e.target.value)}
                id="checkpoint-evidence-text"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-section" style={{ flex: 2 }}>
              <label className="form-label">Evidence Hash (hex)</label>
              <input
                className="form-input form-input--mono"
                placeholder="64 hex characters"
                value={evidenceHash}
                onChange={(e) => setEvidenceHash(e.target.value)}
                id="checkpoint-evidence-input"
              />
            </div>
            <div className="form-section" style={{ flex: 1, alignSelf: "flex-end" }}>
              <button
                type="button"
                className="form-btn-secondary"
                onClick={generateEvidenceHash}
                disabled={hashLoading}
                id="checkpoint-hash-btn"
              >
                {hashLoading ? "…" : "Hash Description"}
              </button>
            </div>
          </div>

          <div className="stream-detail-actions">
            {connected && isRecipient && (stream.status === "active" || stream.status === "paused") && (
              <button
                className="stream-action-btn stream-action-btn--primary"
                onClick={() => doAction("submitCheckpoint")}
                disabled={!!actionLoading}
                id="checkpoint-submit-btn"
              >
                {actionLoading === "submitCheckpoint" ? "…" : "Submit Checkpoint"}
              </button>
            )}
            {connected && isSender && (stream.status === "active" || stream.status === "paused") && (
              <button
                className="stream-action-btn stream-action-btn--success"
                onClick={() => doAction("approveCheckpoint")}
                disabled={!!actionLoading}
                id="checkpoint-approve-btn"
              >
                {actionLoading === "approveCheckpoint" ? "…" : "Approve Checkpoint"}
              </button>
            )}
            {connected && (
              <button
                className="stream-action-btn stream-action-btn--warn"
                onClick={() => doAction("settleCheckpoints")}
                disabled={!!actionLoading}
                id="checkpoint-settle-btn"
              >
                {actionLoading === "settleCheckpoints" ? "…" : "Settle Due Checkpoints"}
              </button>
            )}
          </div>

          <div className="stream-checkpoint-list">
            {checkpoints.length === 0 ? (
              <div className="stream-checkpoint-empty">No checkpoints loaded yet.</div>
            ) : (
              checkpoints.map((checkpoint) => (
                <div key={checkpoint.index} className="stream-checkpoint-card">
                  <div className="stream-checkpoint-card-head">
                    <strong>Checkpoint #{checkpoint.index}</strong>
                    <span
                      className={`stream-checkpoint-state ${checkpoint.approved ? "stream-checkpoint-state--approved" : checkpoint.submitted ? "stream-checkpoint-state--submitted" : "stream-checkpoint-state--pending"}`}
                    >
                      {checkpoint.approved ? "Approved" : checkpoint.submitted ? "Submitted" : "Pending"}
                    </span>
                  </div>
                  <div className="stream-checkpoint-meta">
                    <span>Due ledger {checkpoint.dueLedger.toLocaleString()}</span>
                    <span>
                      Attestation{" "}
                      {checkpoint.attestationId ? (
                        <a href={`/verify/${checkpoint.attestationId}`}>#{checkpoint.attestationId}</a>
                      ) : (
                        "none"
                      )}
                    </span>
                    <span>{checkpoint.autoApproved ? "Auto-approved" : "Manual approval"}</span>
                  </div>
                  <code className="stream-checkpoint-hash">{checkpoint.evidenceHash || "00"}</code>
                </div>
              ))
            )}
          </div>
        </div>

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

        <a
          className="stream-explorer-link"
          href={`https://stellar.expert/explorer/testnet/contract/${STREAM_CONTRACT_ID}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View Stream Contract on Stellar Expert ↗
        </a>
      </div>
    </div>
  );
}
