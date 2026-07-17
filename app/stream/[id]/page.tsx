"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { signMessage } from "@stellar/freighter-api";
import { useWallet } from "@/components/WalletProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import type { WorkSession } from "@/lib/work-session";
import {
  getStream,
  computeAvailable,
  pauseStream,
  resumeStream,
  cancelStream,
  approveReviewedWithdrawal,
  disputeReviewedWithdrawal,
  withdrawReviewed,
  hashEvidence,
  submitCheckpoint,
  approveCheckpoint,
  settleCheckpoints,
  streamContractExplorerUrl,
  StreamObject,
  CheckpointObject,
  getCheckpoint,
  getLatestLedger,
} from "@/lib/stellar";
import { STREAM_CONTRACT_ID } from "@/lib/contracts";
import styles from "./page.module.css";

const STATUS_LABELS: Record<string, string> = {
  active: "🟢 Active",
  paused: "🟡 Paused",
  completed: "✅ Completed",
  cancelled: "🔴 Cancelled",
};

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}H ${minutes}M` : `${minutes}M`;
}

function deadlineLabel(deadline?: string) {
  if (!deadline) return "No deadline";
  const remaining = Math.max(0, Date.parse(deadline) - Date.now());
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return remaining === 0 ? "Review window expired" : `${hours}H ${minutes}M remaining`;
}

function sumRequested(sessions: WorkSession[], statuses: WorkSession["status"][]) {
  return sessions
    .filter((session) => statuses.includes(session.status))
    .reduce((total, session) => total + Number(session.requestedAmount ?? "0"), 0);
}

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
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionAction, setSessionAction] = useState<string | null>(null);
  const [approveSession, setApproveSession] = useState<WorkSession | null>(null);
  const [disputeSession, setDisputeSession] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [checkpointIndex, setCheckpointIndex] = useState("0");
  const [checkpointEvidence, setCheckpointEvidence] = useState("");
  const [checkpoints, setCheckpoints] = useState<CheckpointObject[]>([]);
  const [checkpointsLoading, setCheckpointsLoading] = useState(false);
  const [currentLedger, setCurrentLedger] = useState<number>(0);
  const [tickerSecs, setTickerSecs] = useState<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadCheckpoints(s: StreamObject) {
    if (!s || s.checkpointCount === 0) return;
    setCheckpointsLoading(true);
    try {
      const promises = Array.from({ length: s.checkpointCount }, (_, i) =>
        getCheckpoint(s.id, i, address ?? undefined)
      );
      const list = await Promise.all(promises);
      setCheckpoints(list.filter(Boolean) as CheckpointObject[]);
    } catch (e) {
      console.error("Failed to load checkpoints", e);
    } finally {
      setCheckpointsLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const s = await getStream(id, address ?? undefined);
      setStream(s);
      if (s) {
        await Promise.all([
          computeAvailable(id, address ?? undefined).then(setEarned),
          getLatestLedger().then(setCurrentLedger),
          loadCheckpoints(s),
        ]);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load stream");
    } finally {
      setLoading(false);
    }
  }

  async function loadSessions() {
    if (!address) {
      setSessions([]);
      return;
    }
    setSessionsLoading(true);
    try {
      const response = await fetch(`/api/streams/${encodeURIComponent(id)}/work-sessions?wallet=${encodeURIComponent(address)}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load work sessions.");
      const loaded = data as WorkSession[];
      const expired = loaded.filter(
        (session) =>
          session.status === "PENDING_CLIENT_REVIEW" &&
          session.reviewDeadlineAt &&
          Date.parse(session.reviewDeadlineAt) <= Date.now(),
      );
      if (expired.length > 0) {
        await Promise.all(
          expired.map((session) =>
            fetch(`/api/work-sessions/${encodeURIComponent(session.id)}/finalize-timeout`, {
              method: "POST",
            }),
          ),
        );
        const refreshed = await fetch(`/api/streams/${encodeURIComponent(id)}/work-sessions?wallet=${encodeURIComponent(address)}`, {
          cache: "no-store",
        });
        const refreshedData = await refreshed.json();
        if (refreshed.ok) setSessions(refreshedData as WorkSession[]);
        else setSessions(loaded);
      } else {
        setSessions(loaded);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSessionsLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Poll earned every 6 seconds when active
    pollRef.current = setInterval(async () => {
      const e = await computeAvailable(id, address ?? undefined);
      setEarned(e);
      const l = await getLatestLedger();
      if (l > 0) setCurrentLedger(l);
    }, 6000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, address]);

  useEffect(() => {
    loadSessions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, address]);

  useEffect(() => {
    if (!stream || stream.status !== "active") return;
    const interval = setInterval(() => {
      setTickerSecs((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [stream]);

  useEffect(() => {
    setTickerSecs(0);
  }, [stream, checkpoints, currentLedger]);

  async function walletHeaders(path: string) {
    if (!address) throw new Error("Connect your wallet first.");
    const message = `POST ${path}`;
    const signed = await signMessage(message, { address });
    if (signed.error || !signed.signedMessage) {
      throw new Error(signed.error?.message ?? "The wallet did not return a signature.");
    }
    if (signed.signerAddress && signed.signerAddress.toUpperCase() !== address.toUpperCase()) {
      throw new Error("Freighter signed with a different account. Switch wallets and try again.");
    }
    const signature = typeof signed.signedMessage === "string"
      ? signed.signedMessage
      : window.btoa(Array.from(signed.signedMessage, (byte) => String.fromCharCode(byte)).join(""));
    return {
      "content-type": "application/json",
      "x-aven-wallet": address,
      "x-aven-message": message,
      "x-aven-signature": signature,
    };
  }

  async function mutateSession(sessionId: string, action: "request-withdrawal" | "approve" | "dispute" | "release", body?: object) {
    const path = `/api/work-sessions/${encodeURIComponent(sessionId)}/${action}`;
    setSessionAction(`${sessionId}:${action}`);
    setError(null);
    try {
      const session = sessions.find((candidate) => candidate.id === sessionId);
      if (address && session) {
        if (action === "approve") await approveReviewedWithdrawal(id, address, session.id);
        if (action === "dispute") await disputeReviewedWithdrawal(id, address, session.id);
      }
      const response = await fetch(path, {
        method: "POST",
        headers: await walletHeaders(path),
        body: JSON.stringify(body ?? {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Work-session action failed.");
      setApproveSession(null);
      setDisputeSession(null);
      setDisputeReason("");
      await loadSessions();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSessionAction(null);
    }
  }

  async function releaseSession(session: WorkSession) {
    if (!address) return;
    setSessionAction(`${session.id}:release`);
    setError(null);
    setTxResult(null);
    let transactionSucceeded = false;
    const preparePath = `/api/work-sessions/${encodeURIComponent(session.id)}/release/prepare`;
    const cancelPath = `/api/work-sessions/${encodeURIComponent(session.id)}/release/cancel`;
    try {
      const prepared = await fetch(preparePath, {
        method: "POST",
        headers: await walletHeaders(preparePath),
        body: "{}",
      });
      const preparedData = await prepared.json();
      if (!prepared.ok) throw new Error(preparedData.error ?? "The release could not be prepared.");
      const result = await withdrawReviewed(id, address, session.id);
      transactionSucceeded = true;
      const path = `/api/work-sessions/${encodeURIComponent(session.id)}/release`;
      const response = await fetch(path, {
        method: "POST",
        headers: await walletHeaders(path),
        body: JSON.stringify({ txHash: result.txHash }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "The transaction succeeded but its record could not be updated. Do not submit another withdrawal.");
      }
      setTxResult(`Released ${result.amount.toFixed(7)} ${stream?.asset} · tx: ${result.txHash.slice(0, 10)}…`);
      await Promise.all([load(), loadSessions()]);
    } catch (caught) {
      if (!transactionSucceeded) {
        try {
          await fetch(cancelPath, {
            method: "POST",
            headers: await walletHeaders(cancelPath),
            body: "{}",
          });
        } catch {
          // Preserve the original wallet/transaction error.
        }
      }
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSessionAction(null);
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
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Transaction failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function doCheckpointAction(action: "submit" | "approve" | "settle") {
    if (!address || !stream) return;
    const index = Number.parseInt(checkpointIndex, 10);
    if ((action === "submit" || action === "approve") && (!Number.isInteger(index) || index < 0 || index >= stream.checkpointCount)) {
      setError(`Checkpoint index must be between 0 and ${Math.max(stream.checkpointCount - 1, 0)}.`);
      return;
    }
    setActionLoading(`checkpoint:${action}`);
    setError(null);
    setTxResult(null);
    try {
      if (action === "submit") {
        if (!checkpointEvidence.trim()) throw new Error("Add a short work note or a 32-byte evidence hash.");
        const rawEvidence = checkpointEvidence.trim().replace(/^0x/, "");
        const evidenceHash = /^[a-fA-F0-9]{64}$/.test(rawEvidence)
          ? rawEvidence
          : await hashEvidence(checkpointEvidence.trim());
        await submitCheckpoint(id, address, index, evidenceHash);
        setTxResult(`Checkpoint #${index} submitted with evidence ${evidenceHash.slice(0, 12)}…`);
        setCheckpointEvidence("");
      }
      if (action === "approve") {
        await approveCheckpoint(id, address, index);
        setTxResult(`Checkpoint #${index} approved.`);
      }
      if (action === "settle") {
        const settled = await settleCheckpoints(id, address);
        setTxResult(`${settled} checkpoint${settled === 1 ? "" : "s"} settled.`);
      }
      await Promise.all([load(), loadSessions()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
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
  const pendingAmount = sumRequested(sessions, ["WITHDRAWAL_REQUESTED", "PENDING_CLIENT_REVIEW", "APPROVED"]);
  const releasedAmount = sumRequested(sessions, ["RELEASED", "RELEASE_ELIGIBLE", "RELEASING"]);
  const disputedAmount = sumRequested(sessions, ["DISPUTED", "RESPONSE_SUBMITTED"]);

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

        {/* Live earnings ticker — active streams */}
        {stream.status === "active" && (() => {
          // Estimate elapsed ledgers client-side using tickerSecs (1 ledger ≈ 5s)
          const estimatedExtraLedgers = tickerSecs / 5;
          const elapsedLedgers = Math.min(
            stream.durationLedgers,
            Math.max(
              0,
              currentLedger + estimatedExtraLedgers
                - stream.startLedger
                - (stream.pausedDurationLedgers ?? 0)
            )
          );
          const totalVested = elapsedLedgers * stream.ratePerLedger;
          const capPct = (stream.withdrawableCapPercent ?? 65) / 100;

          // Compute how much of vested is covered by approved checkpoints
          let approvedVested = 0;
          let unapprovedVested = totalVested;
          if (stream.checkpointCount > 0 && stream.checkpointSpanLedgers > 0) {
            const cpLedgers = stream.checkpointSpanLedgers;
            checkpoints.forEach((cp, i) => {
              const cpStart = stream.startLedger + i * cpLedgers;
              const cpEnd = cpStart + cpLedgers;
              const cpElapsed = Math.min(cpLedgers, Math.max(0, (currentLedger + estimatedExtraLedgers) - cpStart));
              const cpVested = cpElapsed * stream.ratePerLedger;
              if (cp.approved || cp.autoApproved) {
                approvedVested += cpVested;
                unapprovedVested -= cpVested;
              }
            });
          }
          const withdrawableNow = Math.min(
            approvedVested + unapprovedVested * capPct,
            totalVested
          );
          const pendingApproval = totalVested - withdrawableNow;

          return (
            <div className="stream-ticker-wrap">
              <div className="stream-ticker-item">
                <div className="stream-ticker-label">Total Vested</div>
                <div className="stream-ticker-value mono">
                  {totalVested.toFixed(6)}
                  <span className="stream-ticker-asset"> {stream.asset}</span>
                </div>
              </div>
              <div className="stream-ticker-item stream-ticker-item--green">
                <div className="stream-ticker-label">Withdrawable Now <span className="stream-ticker-cap">({stream.withdrawableCapPercent ?? 65}% cap)</span></div>
                <div className="stream-ticker-value mono">
                  {withdrawableNow.toFixed(6)}
                  <span className="stream-ticker-asset"> {stream.asset}</span>
                </div>
              </div>
              <div className="stream-ticker-item stream-ticker-item--amber">
                <div className="stream-ticker-label">Pending Client Approval</div>
                <div className="stream-ticker-value mono">
                  {pendingApproval.toFixed(6)}
                  <span className="stream-ticker-asset"> {stream.asset}</span>
                </div>
              </div>
            </div>
          );
        })()}
        {stream.status === "paused" && (
          <div className="stream-ticker-wrap">
            <div className="stream-ticker-item">
              <div className="stream-ticker-label">Withdrawable (on-chain)</div>
              <div className="stream-ticker-value mono">
                {earned.toFixed(6)}
                <span className="stream-ticker-asset"> {stream.asset}</span>
              </div>
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
            <div className="stream-detail-item-label">Work evidence</div>
            <div className="stream-detail-item-value">
              {sessions.length > 0 ? `${sessions.length} session record${sessions.length === 1 ? "" : "s"}` : "No sessions yet"}
            </div>
          </div>
        </div>

        {/* ── Checkpoints Panel ── */}
        {stream.checkpointCount > 0 && (
          <section className="checkpoint-section">
            <div className="checkpoint-section-header">
              <div>
                <span className="checkpoint-eyebrow">STREAM / MILESTONES</span>
                <h2>Checkpoints</h2>
              </div>
              <span className="checkpoint-count">{stream.checkpointCount}</span>
            </div>

            {checkpointsLoading ? (
              <div className="checkpoint-loading"><div className="dash-spinner" /> Loading checkpoints…</div>
            ) : (
              <div className="checkpoint-list">
                {Array.from({ length: stream.checkpointCount }, (_, i) => {
                  const cp = checkpoints[i];
                  const dueLedger = stream.startLedger + (i + 1) * stream.checkpointSpanLedgers;
                  const elapsed = currentLedger > 0 && currentLedger >= dueLedger;
                  const statusLabel = !cp
                    ? "Not Submitted"
                    : cp.approved
                    ? "✅ Approved"
                    : cp.autoApproved
                    ? "✅ Auto-Approved"
                    : cp.submitted
                    ? "⏳ Pending Approval"
                    : "📝 Not Submitted";

                  return (
                    <div
                      key={i}
                      className={`checkpoint-card${cp?.approved || cp?.autoApproved ? " checkpoint-card--approved" : cp?.submitted ? " checkpoint-card--pending" : ""}`}
                    >
                      <div className="checkpoint-card-header">
                        <span className="checkpoint-num">#{i + 1}</span>
                        <span className="checkpoint-status">{statusLabel}</span>
                        <span className="checkpoint-due" title={elapsed ? "Deadline passed" : "Future deadline"}>
                          Due ledger #{dueLedger.toLocaleString()}
                          {elapsed && <span className="checkpoint-overdue"> · ELAPSED</span>}
                        </span>
                      </div>
                      {cp?.submitted && cp.evidenceHash && (
                        <div className="checkpoint-evidence">
                          Evidence: <code title={cp.evidenceHash}>{cp.evidenceHash.slice(0, 16)}…</code>
                        </div>
                      )}

                      {/* Recipient: submit evidence for this checkpoint */}
                      {isRecipient && !cp?.submitted && (
                        <div className="checkpoint-form">
                          <input
                            id={`checkpoint-evidence-${i}`}
                            type="text"
                            className="form-input"
                            placeholder="Work note or 32-byte hex evidence hash"
                            value={Number(checkpointIndex) === i ? checkpointEvidence : ""}
                            onFocus={() => setCheckpointIndex(String(i))}
                            onChange={(e) => {
                              setCheckpointIndex(String(i));
                              setCheckpointEvidence(e.target.value);
                            }}
                          />
                          <button
                            className="checkpoint-btn checkpoint-btn--submit"
                            type="button"
                            disabled={actionLoading === `checkpoint:submit` && Number(checkpointIndex) === i}
                            onClick={() => {
                              setCheckpointIndex(String(i));
                              void doCheckpointAction("submit");
                            }}
                          >
                            {actionLoading === `checkpoint:submit` && Number(checkpointIndex) === i ? "Submitting…" : "Submit Checkpoint"}
                          </button>
                        </div>
                      )}

                      {/* Client: approve a submitted but unapproved checkpoint */}
                      {isSender && cp?.submitted && !cp.approved && !cp.autoApproved && (
                        <div className="checkpoint-form">
                          <button
                            className="checkpoint-btn checkpoint-btn--approve"
                            type="button"
                            disabled={actionLoading === `checkpoint:approve` && Number(checkpointIndex) === i}
                            onClick={() => {
                              setCheckpointIndex(String(i));
                              void doCheckpointAction("approve");
                            }}
                          >
                            {actionLoading === `checkpoint:approve` && Number(checkpointIndex) === i ? "Approving…" : "Approve Checkpoint"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Settle elapsed checkpoints (auto-approve) — any connected party */}
            {connected && (isSender || isRecipient) && (
              <div className="checkpoint-settle-row">
                <button
                  className="checkpoint-btn checkpoint-btn--settle"
                  type="button"
                  disabled={actionLoading === "checkpoint:settle"}
                  onClick={() => void doCheckpointAction("settle")}
                >
                  {actionLoading === "checkpoint:settle" ? "Settling…" : "Settle Elapsed Checkpoints"}
                </button>
                <span className="checkpoint-settle-hint">
                  Auto-approves any checkpoint whose deadline has passed without client approval.
                </span>
              </div>
            )}
          </section>
        )}

        <section className={styles["work-session-section"]}>
          <div className={styles["work-session-heading"]}>
            <div>
              <span className={styles["work-session-eyebrow"]}>STREAM / WORK RECORD</span>
              <h2>Work Sessions</h2>
            </div>
            <span className={styles["work-session-count"]}>{sessions.length.toString().padStart(2, "0")}</span>
          </div>

          <div className={styles["work-session-summary"]}>
            <div><span>Available</span><strong>{earned.toFixed(7)} {stream.asset}</strong></div>
            <div><span>Pending review</span><strong>{pendingAmount.toFixed(7)} {stream.asset}</strong></div>
            <div><span>Release eligible</span><strong>{releasedAmount.toFixed(7)} {stream.asset}</strong></div>
            <div><span>Disputed</span><strong>{disputedAmount.toFixed(7)} {stream.asset}</strong></div>
          </div>

          {isRecipient && (
            <div className={styles["work-session-setup"]}>
              <span>Connect a project</span>
              <code>npx aven-stellar start</code>
              <code>npx aven-stellar stop</code>
              <p>The package records Git metadata and change statistics. It does not execute your code or upload full files.</p>
            </div>
          )}

          {sessionsLoading ? (
            <div className={styles["work-session-empty"]}>Loading work sessions…</div>
          ) : sessions.length === 0 ? (
            <div className={styles["work-session-empty"]}>
              No work sessions have been submitted for this stream.
            </div>
          ) : (
            <div className={styles["work-session-list"]}>
              {sessions.map((session, index) => {
                const report = session.report;
                const expanded = expandedSession === session.id;
                const actionBusy = sessionAction?.startsWith(`${session.id}:`) ?? false;
                return (
                  <article className={styles["work-session-card"]} key={session.id}>
                    <button
                      className={styles["work-session-card-header"]}
                      type="button"
                      onClick={() => setExpandedSession(expanded ? null : session.id)}
                    >
                      <div>
                        <span>Session #{sessions.length - index}</span>
                        <strong>{report ? new Date(report.session.endedAt).toLocaleDateString() : "REPORT PENDING"}</strong>
                        {report?.session?.ended && (
                          <span style={{ marginLeft: "8px", background: "#ef4444", color: "#fff", fontSize: "10px", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold", textTransform: "uppercase" }}>
                            Project Complete
                          </span>
                        )}
                      </div>
                      <div>
                        <span>{session.status.replaceAll("_", " ")}</span>
                        <strong>{report ? formatDuration(report.session.totalSeconds) : "—"}</strong>
                      </div>
                    </button>

                    <div className={styles["work-session-card-metrics"]}>
                      <span>{report?.changes.changedFiles.length ?? 0} files changed</span>
                      <span>{report?.changes.additions.toLocaleString() ?? 0} additions</span>
                      <span>{report?.changes.deletions.toLocaleString() ?? 0} deletions</span>
                      <span>{session.requestedAmount ?? report?.paymentRequest.requestedAmount ?? "0.0000000"} {stream.asset}</span>
                    </div>

                    {session.status === "PENDING_CLIENT_REVIEW" && (
                      <div className={styles["work-session-deadline"]}>{deadlineLabel(session.reviewDeadlineAt)}</div>
                    )}

                    {expanded && report && (
                      <div className={styles["work-session-expanded"]}>
                        <div className={styles["work-session-statement"]}>
                          <span>Worker statement</span>
                          <p>{report.workerStatement?.message ?? "No worker statement was provided."}</p>
                          {report.session?.ended && (
                            <div style={{ marginTop: "12px", padding: "10px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "6px", fontSize: "13px", color: "#f87171" }}>
                              <strong>Final Release Requested:</strong> The worker has marked this project as complete and is requesting a full release of the remaining stream balance. If approved, the funds will be reserved on-chain.
                            </div>
                          )}
                        </div>
                        <div className={styles["work-session-verification"]}>
                          <span>Verification</span>
                          <p>{session.verificationSummary ?? report.localVerification.summary}</p>
                          {session.reportDigest && (
                            <code title={session.reportDigest}>On-chain report {session.reportDigest.slice(0, 12)}…</code>
                          )}
                          {(session.verificationFlags ?? report.localVerification.flags).length > 0 && (
                            <div>{(session.verificationFlags ?? report.localVerification.flags).map((flag) => <code key={flag}>{flag}</code>)}</div>
                          )}
                        </div>
                        <div className={styles["work-session-files"]}>
                          <span>
                            Changed files
                            {report.privacy.excludedFileCount > 0
                              ? ` · ${report.privacy.excludedFileCount} privacy-excluded`
                              : ""}
                          </span>
                          {report.changes.changedFiles.filter((file) => file.includedInVerification).map((file) => (
                            <div key={`${file.path}:${file.changeType}`}>
                              <code>{file.path}</code>
                              <span>{file.changeType} · +{file.additions ?? 0} / -{file.deletions ?? 0}</span>
                            </div>
                          ))}
                        </div>
                        <div className={styles["work-session-timeline"]}>
                          <span>Timeline</span>
                          {(session.timeline ?? []).map((event, eventIndex) => (
                            <div key={`${event.at}:${eventIndex}`}>
                              <time>{new Date(event.at).toLocaleString()}</time>
                              <strong>{event.status.replaceAll("_", " ")}</strong>
                              {event.note && <p>{event.note}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className={styles["work-session-actions"]}>
                      <button type="button" onClick={() => setExpandedSession(expanded ? null : session.id)}>
                        {expanded ? "Hide details ↑" : "View details ↓"}
                      </button>
                      {isRecipient && session.status === "VERIFICATION_COMPLETE" && (
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => mutateSession(session.id, "request-withdrawal")}
                        >
                          {actionBusy ? "Requesting…" : "Request withdrawal"}
                        </button>
                      )}
                      {isRecipient && session.status === "RELEASE_ELIGIBLE" && (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => releaseSession(session)}
                          >
                            {actionBusy ? "Releasing…" : `Withdraw ${session.requestedAmount ?? report?.paymentRequest.requestedAmount ?? "0.0000000"} ${stream.asset}`}
                          </button>
                          {report?.session?.ended && (
                            <span style={{ fontSize: "11px", color: "var(--text-secondary)", textAlign: "right" }}>
                              Note: This is a full release. If the stream timeline hasn't fully elapsed, funds withdraw as they vest on-chain.
                            </span>
                          )}
                        </div>
                      )}
                      {isSender && session.status === "PENDING_CLIENT_REVIEW" && (
                        <>
                          <button type="button" disabled={actionBusy} onClick={() => setApproveSession(session)}>Approve</button>
                          <button type="button" disabled={actionBusy} onClick={() => setDisputeSession(disputeSession === session.id ? null : session.id)}>Dispute</button>
                        </>
                      )}
                    </div>

                    {isSender && disputeSession === session.id && (
                      <div className={styles["work-session-dispute"]}>
                        <label htmlFor={`dispute-${session.id}`}>Explain the dispute</label>
                        <textarea
                          id={`dispute-${session.id}`}
                          value={disputeReason}
                          onChange={(event) => setDisputeReason(event.target.value)}
                          placeholder="Explain what appears incomplete or misleading (minimum 20 characters)."
                        />
                        <button
                          type="button"
                          disabled={disputeReason.trim().length < 20 || actionBusy}
                          onClick={() => mutateSession(session.id, "dispute", { reason: disputeReason })}
                        >
                          Submit dispute
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

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
          </div>
        )}

        {/* Explorer link — points to the stream contract, not a user address */}
        <a
          className="stream-explorer-link"
          href={`https://stellar.expert/explorer/testnet/contract/${STREAM_CONTRACT_ID}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View Stream Contract on Stellar Expert ↗
        </a>
      </div>

      <ConfirmModal
        open={Boolean(approveSession)}
        title="Approve work session"
        description={`Approve ${approveSession?.requestedAmount ?? approveSession?.report?.paymentRequest.requestedAmount ?? "0.0000000"} ${stream.asset} for release?`}
        confirmLabel="Approve session"
        onClose={() => setApproveSession(null)}
        onConfirm={() => {
          if (approveSession) void mutateSession(approveSession.id, "approve");
        }}
      />
    </div>
  );
}
