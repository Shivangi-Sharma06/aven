"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { signMessage } from "@stellar/freighter-api";
import { useWallet } from "@/components/WalletProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import type { WorkSession } from "@/lib/work-session";
import { STREAM_CONTRACT_ID } from "@/lib/contracts";
import {
  getStream,
  computeAvailable,
  pauseStream,
  resumeStream,
  cancelStream,
  approveReviewedWithdrawal,
  disputeReviewedWithdrawal,
  withdrawReviewed,
  StreamObject,
} from "@/lib/stellar";
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
  const [availableEscrow, setAvailableEscrow] = useState(0);
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
  async function load() {
    setLoading(true);
    try {
      const s = await getStream(id, address ?? undefined);
      setStream(s);
      if (s) {
        const e = await computeAvailable(id, address ?? undefined);
        setAvailableEscrow(e);
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
      await ensureBrowserSession();
      const sessionsPath = `/api/streams/${encodeURIComponent(id)}/work-sessions`;
      const response = await fetch(sessionsPath, { cache: "no-store" });
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
        const refreshed = await fetch(sessionsPath, { cache: "no-store" });
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, address]);

  useEffect(() => {
    loadSessions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, address]);

  async function ensureBrowserSession(): Promise<void> {
    if (!address) throw new Error("Connect your wallet first.");
    const storageKey = `aven:browser-session:${address.toUpperCase()}`;
    const cached = window.sessionStorage.getItem(storageKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { expiresAt: number };
        if (parsed.expiresAt > Date.now() + 30_000) return; // session still valid
      } catch {
        window.sessionStorage.removeItem(storageKey);
      }
    }

    // Step 1: Get a single-line challenge (no newlines) from the server.
    const challengeResponse = await fetch("/api/auth/wallet/challenge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ walletAddress: address }),
    });
    const challengeData = await challengeResponse.json();
    if (!challengeResponse.ok) throw new Error(challengeData.error ?? "Failed to create auth challenge.");
    const { challenge, expiresAt } = challengeData as { challenge: string; expiresAt: number };

    // Safety assertion: challenge must have no newline characters.
    if (/[\r\n]/.test(challenge)) throw new Error("Server returned an invalid challenge.");

    // Step 2: Sign the single-line challenge with the wallet.
    const signed = await signMessage(challenge, { address });
    if (signed.error || !signed.signedMessage) {
      throw new Error(signed.error?.message ?? "The wallet did not return a signature.");
    }
    if (signed.signerAddress && signed.signerAddress.toUpperCase() !== address.toUpperCase()) {
      throw new Error("Freighter signed with a different account. Switch wallets and try again.");
    }
    const signature = typeof signed.signedMessage === "string"
      ? signed.signedMessage
      : window.btoa(Array.from(signed.signedMessage, (byte) => String.fromCharCode(byte)).join(""));

    // Step 3: Verify on the server — server sets the aven_session HttpOnly cookie.
    const verifyResponse = await fetch("/api/auth/wallet/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ walletAddress: address, challenge, signature }),
    });
    const verifyData = await verifyResponse.json();
    if (!verifyResponse.ok) throw new Error(verifyData.error ?? "Wallet verification failed.");

    // Cache the expiry so we know when to renew.
    window.sessionStorage.setItem(storageKey, JSON.stringify({ expiresAt }));
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
      await ensureBrowserSession();
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
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
      await ensureBrowserSession();
      const prepared = await fetch(preparePath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const preparedData = await prepared.json();
      if (!prepared.ok) throw new Error(preparedData.error ?? "The release could not be prepared.");
      const result = await withdrawReviewed(id, address, session.id);
      transactionSucceeded = true;
      const path = `/api/work-sessions/${encodeURIComponent(session.id)}/release`;
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
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
            headers: { "content-type": "application/json" },
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

        {(stream.status === "active" || stream.status === "paused") && (
          <div className="stream-detail-earned-wrap">
            <div className="stream-detail-earned-label">Unreserved escrow</div>
            <div className="stream-detail-earned-value">
              {availableEscrow.toFixed(6)} <span className="stream-detail-earned-asset">{stream.asset}</span>
            </div>
            <p className="stream-detail-earned-label">
              This changes only when an npm-tracked work session reserves or releases payment.
            </p>
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
            <div className="stream-detail-item-label">Rate / active second</div>
            <div className="stream-detail-item-value">{(stream.ratePerLedger / 5).toFixed(7)} {stream.asset}</div>
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
              {!address
                ? "Connect wallet to view"
                : sessions.length > 0
                  ? `${sessions.length} session record${sessions.length === 1 ? "" : "s"}`
                  : "No sessions yet"}
            </div>
          </div>
        </div>

        <section className={styles["work-session-section"]}>
          <div className={styles["work-session-heading"]}>
            <div>
              <span className={styles["work-session-eyebrow"]}>STREAM / WORK RECORD</span>
              <h2>Work Sessions</h2>
            </div>
            <span className={styles["work-session-count"]}>{sessions.length.toString().padStart(2, "0")}</span>
          </div>

          <div className={styles["work-session-summary"]}>
            <div><span>Unreserved escrow</span><strong>{availableEscrow.toFixed(7)} {stream.asset}</strong></div>
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

          {!address ? (
            <div className={styles["work-session-empty"]}>
              Connect the sender or recipient wallet to view private work-session metadata.
            </div>
          ) : sessionsLoading ? (
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
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => releaseSession(session)}
                        >
                          {actionBusy ? "Releasing…" : `Withdraw ${session.requestedAmount ?? report?.paymentRequest.requestedAmount ?? "0.0000000"} ${stream.asset}`}
                        </button>
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

        {/* Explorer link */}
        <a
          className="stream-explorer-link"
          href={`https://stellar.expert/explorer/testnet/contract/${STREAM_CONTRACT_ID}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on Stellar Expert ↗
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
