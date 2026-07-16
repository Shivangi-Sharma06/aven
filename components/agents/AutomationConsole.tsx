"use client";

import { useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import {
  changeMandateStatus,
  depositMandate,
  loadMandateSnapshot,
  loadProposal,
  resolveProposal,
  setMandateRecipient,
  updateMandatePolicy,
  withdrawMandateFunds,
  type MandateSnapshot,
  type StreamProposal,
} from "@/lib/agent-automation";
import { fromContractAmount, toContractAmount, USDC_ASSET_ID, XLM_ASSET_ID } from "@/lib/contracts";

function compact(address: string) {
  return `${address.slice(0, 7)}…${address.slice(-5)}`;
}

export function AutomationConsole() {
  const { connected, address, openConnectModal } = useWallet();
  const [mandateAddress, setMandateAddress] = useState("");
  const [asset, setAsset] = useState(USDC_ASSET_ID);
  const [snapshot, setSnapshot] = useState<MandateSnapshot | null>(null);
  const [amount, setAmount] = useState("10");
  const [recipient, setRecipient] = useState("");
  const [proposalId, setProposalId] = useState("");
  const [proposal, setProposal] = useState<StreamProposal | null>(null);
  const [perStream, setPerStream] = useState("");
  const [windowLimit, setWindowLimit] = useState("");
  const [approvalThreshold, setApprovalThreshold] = useState("");
  const [expiryLedger, setExpiryLedger] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!address) return;
    setBusy("refresh");
    setError(null);
    try {
      const next = await loadMandateSnapshot(mandateAddress.trim(), address, asset);
      setSnapshot(next);
      setPerStream(String(fromContractAmount(next.config.policy.per_stream_limit)));
      setWindowLimit(String(fromContractAmount(next.config.policy.window_limit)));
      setApprovalThreshold(String(fromContractAmount(next.config.policy.human_approval_threshold)));
      setExpiryLedger(String(next.config.policy.expires_at_ledger));
      setMessage("Mandate state refreshed from Stellar testnet.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  async function action(name: string, operation: () => Promise<unknown>, success: string) {
    setBusy(name);
    setError(null);
    setMessage(null);
    try {
      await operation();
      setMessage(success);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(null);
    }
  }

  if (!connected || !address) {
    return (
      <section className="automation-empty">
        <span className="automation-eyebrow">OWNER CONSOLE / TESTNET</span>
        <h2>Give an agent a budget. Keep the limits.</h2>
        <p>Connect the owner wallet to inspect, fund, pause, or revoke an existing Agent Mandate.</p>
        <button className="form-btn" onClick={openConnectModal}>Connect owner wallet</button>
      </section>
    );
  }

  const config = snapshot?.config;
  const isOwner = config?.owner === address;

  return (
    <div className="automation-console">
      <header className="automation-intro">
        <span className="automation-eyebrow">AGENT MANDATE / STELLAR TESTNET</span>
        <h2>Automation without an open wallet.</h2>
        <p>A mandate holds a limited budget and enforces the rules on-chain. The runner can execute small jobs; larger payments wait for you.</p>
      </header>

      <section className="automation-connect protocol-box">
        <label className="form-label" htmlFor="mandate-address">Mandate contract</label>
        <div className="automation-inline">
          <input id="mandate-address" className="form-input form-input--mono" value={mandateAddress} onChange={(event) => setMandateAddress(event.target.value)} placeholder="C…" />
          <select className="form-select" value={asset} onChange={(event) => setAsset(event.target.value)} aria-label="Budget asset">
            <option value={USDC_ASSET_ID}>USDC</option>
            <option value={XLM_ASSET_ID}>XLM</option>
          </select>
          <button className="form-btn" onClick={refresh} disabled={busy === "refresh"}>{busy === "refresh" ? "Reading…" : "Connect mandate"}</button>
        </div>
      </section>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      {snapshot && config && (
        <>
          <section className="automation-metrics">
            <article><span>Status</span><strong>{config.revoked ? "Revoked" : config.paused ? "Paused" : "Active"}</strong></article>
            <article><span>Available</span><strong>{snapshot.balance.toLocaleString()} {asset === USDC_ASSET_ID ? "USDC" : "XLM"}</strong></article>
            <article><span>Window spend</span><strong>{fromContractAmount(snapshot.spendWindow.spent).toLocaleString()}</strong></article>
            <article><span>Expires ledger</span><strong>{config.policy.expires_at_ledger.toLocaleString()}</strong></article>
          </section>

          <section className="automation-identities protocol-box">
            <div><span>Owner</span><code title={config.owner}>{compact(config.owner)}</code></div>
            <div><span>Agent</span><code title={config.agent}>{compact(config.agent)}</code></div>
            <div><span>Stream contract</span><code title={config.stream_contract}>{compact(config.stream_contract)}</code></div>
          </section>

          {!isOwner && <div className="automation-warning">This wallet can inspect the mandate, but owner actions require {compact(config.owner)}.</div>}

          <div className="automation-grid">
            <section className="protocol-box">
              <span className="automation-section-no">01 / BUDGET</span>
              <h3>Fund only what the agent may spend.</h3>
              <label className="form-label" htmlFor="mandate-amount">Amount</label>
              <input id="mandate-amount" className="form-input" type="number" min="0" step="0.0000001" value={amount} onChange={(event) => setAmount(event.target.value)} />
              <div className="automation-actions">
                <button className="form-btn" disabled={!isOwner || Boolean(busy)} onClick={() => action("deposit", () => depositMandate(snapshot.address, address, asset, Number(amount)), "Budget deposited.")}>Deposit</button>
                <button className="form-btn-secondary" disabled={!isOwner || Boolean(busy)} onClick={() => action("withdraw", () => withdrawMandateFunds(snapshot.address, address, asset, Number(amount)), "Unused budget recovered.")}>Recover unused</button>
              </div>
            </section>

            <section className="protocol-box">
              <span className="automation-section-no">02 / POLICY</span>
              <h3>Small jobs move. Large jobs wait.</h3>
              <div className="automation-field-grid">
                <label><span>Per-stream cap</span><input className="form-input" type="number" value={perStream} onChange={(event) => setPerStream(event.target.value)} /></label>
                <label><span>Rolling-window cap</span><input className="form-input" type="number" value={windowLimit} onChange={(event) => setWindowLimit(event.target.value)} /></label>
                <label><span>Owner approval at</span><input className="form-input" type="number" value={approvalThreshold} onChange={(event) => setApprovalThreshold(event.target.value)} /></label>
                <label><span>Expiry ledger</span><input className="form-input" type="number" value={expiryLedger} onChange={(event) => setExpiryLedger(event.target.value)} /></label>
              </div>
              <button className="form-btn" disabled={!isOwner || Boolean(busy)} onClick={() => action("policy", () => updateMandatePolicy(snapshot.address, address, {
                ...config.policy,
                per_stream_limit: toContractAmount(Number(perStream)),
                window_limit: toContractAmount(Number(windowLimit)),
                human_approval_threshold: toContractAmount(Number(approvalThreshold)),
                expires_at_ledger: Number(expiryLedger),
              }), "Policy updated on-chain.")}>Save policy</button>
            </section>

            <section className="protocol-box">
              <span className="automation-section-no">03 / RECIPIENTS</span>
              <h3>Decide where delegated money may go.</h3>
              <input className="form-input form-input--mono" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="G… or C… recipient" />
              <div className="automation-actions">
                <button className="form-btn" disabled={!isOwner || Boolean(busy)} onClick={() => action("allow", () => setMandateRecipient(snapshot.address, address, recipient.trim(), true), "Recipient allowed.")}>Allow</button>
                <button className="form-btn-secondary" disabled={!isOwner || Boolean(busy)} onClick={() => action("remove", () => setMandateRecipient(snapshot.address, address, recipient.trim(), false), "Recipient removed.")}>Remove</button>
              </div>
              <p className="automation-note">Allowlist enforcement is {config.policy.enforce_recipient_allowlist ? "on" : "off"}.</p>
            </section>

            <section className="protocol-box">
              <span className="automation-section-no">04 / APPROVALS</span>
              <h3>Review the jobs above the threshold.</h3>
              <div className="automation-inline">
                <input className="form-input" type="number" min="1" value={proposalId} onChange={(event) => setProposalId(event.target.value)} placeholder="Proposal ID" />
                <button className="form-btn-secondary" disabled={!proposalId || Boolean(busy)} onClick={async () => {
                  setBusy("proposal"); setError(null);
                  try { setProposal(await loadProposal(snapshot.address, address, BigInt(proposalId))); }
                  catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
                  finally { setBusy(null); }
                }}>Load</button>
              </div>
              {proposal && (
                <div className="proposal-review">
                  <div><span>Recipient</span><code>{compact(proposal.params.recipient)}</code></div>
                  <div><span>Amount</span><strong>{fromContractAmount(proposal.params.total_deposited).toLocaleString()}</strong></div>
                  <div><span>Duration</span><strong>{proposal.params.duration_ledgers.toLocaleString()} ledgers</strong></div>
                  <div><span>Checkpoints</span><strong>{proposal.params.checkpoint_count}</strong></div>
                  <div><span>Status</span><strong>{proposal.status.tag}</strong></div>
                  <div className="automation-actions">
                    <button className="form-btn" disabled={!isOwner || proposal.status.tag !== "Pending" || Boolean(busy)} onClick={() => action("approve", () => resolveProposal(snapshot.address, address, proposal.id, true), "Proposal approved and stream created.")}>Approve & execute</button>
                    <button className="form-btn-secondary" disabled={!isOwner || proposal.status.tag !== "Pending" || Boolean(busy)} onClick={() => action("reject", () => resolveProposal(snapshot.address, address, proposal.id, false), "Proposal rejected.")}>Reject</button>
                  </div>
                </div>
              )}
            </section>
          </div>

          <section className="automation-controls protocol-box">
            <div><span className="automation-section-no">EMERGENCY CONTROL</span><h3>Stop first. Investigate second.</h3></div>
            <div className="automation-actions">
              <button className="form-btn-secondary" disabled={!isOwner || config.paused || config.revoked || Boolean(busy)} onClick={() => action("pause", () => changeMandateStatus(snapshot.address, address, "pause"), "Mandate paused.")}>Pause</button>
              <button className="form-btn-secondary" disabled={!isOwner || !config.paused || config.revoked || Boolean(busy)} onClick={() => action("resume", () => changeMandateStatus(snapshot.address, address, "resume"), "Mandate resumed.")}>Resume</button>
              <button className="automation-danger" disabled={!isOwner || config.revoked || Boolean(busy)} onClick={() => {
                if (window.confirm("Revoke this mandate permanently? This cannot be undone.")) {
                  void action("revoke", () => changeMandateStatus(snapshot.address, address, "revoke"), "Mandate permanently revoked.");
                }
              }}>Revoke permanently</button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
