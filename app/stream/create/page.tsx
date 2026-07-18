"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/components/WalletProvider";
import { createStream, CreateStreamInput } from "@/lib/stellar";

type Category = "Freelance" | "Salary" | "Bounty" | "Grant" | "AgentTask" | "Subscription";
type Asset = "USDC" | "XLM";

const CATEGORIES: Category[] = ["Freelance", "Salary", "Bounty", "Grant", "AgentTask", "Subscription"];

// Approximate: 5 sec/ledger on testnet
const SECONDS_PER_LEDGER = 5;
const LEDGERS_PER_HOUR = Math.round(3600 / SECONDS_PER_LEDGER);
const LEDGERS_PER_DAY = LEDGERS_PER_HOUR * 24;

export default function CreateStreamPage() {
  const { connected, address, openConnectModal } = useWallet();
  const router = useRouter();

  const [recipient, setRecipient] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [durationDays, setDurationDays] = useState("7");
  const [ratePerSecond, setRatePerSecond] = useState("");
  const [category, setCategory] = useState<Category>("Freelance");
  const [asset, setAsset] = useState<Asset>("USDC");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ streamId: string; txHash: string } | null>(null);

  // Auto-compute rate from total + duration (rounded down to 7 decimal places for contract safety)
  const durationLedgers = durationDays ? Math.round(parseFloat(durationDays) * LEDGERS_PER_DAY) : 0;
  const computedRate =
    totalAmount && durationLedgers > 0
      ? (Math.floor((parseFloat(totalAmount) * 10000000) / (durationLedgers * SECONDS_PER_LEDGER)) / 10000000).toFixed(7)
      : "";

  function friendlyError(raw: string): string {
    if (raw.includes("trustline entry is missing")) {
      const acct = raw.match(/GDW[A-Z0-9]{53}|G[A-Z0-9]{54}/)?.[0] ?? "your account";
      return `USDC trustline missing on ${acct.slice(0, 8)}…${acct.slice(-6)}. ` +
        `Add a USDC trustline in Stellar Laboratory or Freighter before creating a USDC stream. ` +
        `(Or switch the asset to XLM — XLM needs no trustline.)`;
    }
    if (raw.includes("insufficient funds") || raw.includes("balance would go below")) {
      return "Insufficient balance. Make sure you have enough funds to cover the stream amount plus transaction fees.";
    }
    if (raw.includes("User declined") || raw.includes("user rejected")) {
      return "Transaction was cancelled in Freighter.";
    }
    return raw;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!connected || !address) return openConnectModal();

    const total = parseFloat(totalAmount);
    const days = parseFloat(durationDays);
    const rate = parseFloat(ratePerSecond || computedRate);

    if (!recipient.startsWith("G") || recipient.length < 56) {
      setError("Recipient must be a valid Stellar address starting with G");
      return;
    }
    if (recipient.trim().toUpperCase() === address.trim().toUpperCase()) {
      setError("Sender and recipient must be different Stellar wallets.");
      return;
    }
    if (!title.trim()) { setError("Title is required"); return; }
    if (!total || total <= 0) { setError("Total amount must be > 0"); return; }
    if (!days || days <= 0) { setError("Duration must be > 0"); return; }

    setLoading(true);
    setError(null);
    try {
      const input: CreateStreamInput = {
        recipient,
        totalAmount: total,
        asset,
        durationLedgers: Math.round(days * LEDGERS_PER_DAY),
        ratePerSecond: rate,
        category,
        title: title.trim(),
      };
      const result = await createStream(input, address);
      setSuccess(result);
    } catch (e: any) {
      setError(friendlyError(e?.message ?? "Transaction failed. Check Freighter for details."));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="form-success-wrap">
        <div className="form-success-icon">✅</div>
        <h2>Stream Created!</h2>
        <p className="form-success-sub">Your payment stream is live on Stellar testnet.</p>
        <div className="form-success-detail">
          <div className="form-detail-row">
            <span className="form-detail-label">Stream ID</span>
            <span className="form-detail-value">#{success.streamId}</span>
          </div>
          <div className="form-detail-row">
            <span className="form-detail-label">Tx Hash</span>
            <a
              className="form-detail-link"
              href={`https://stellar.expert/explorer/testnet/tx/${success.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {success.txHash.slice(0, 12)}…{success.txHash.slice(-8)}
            </a>
          </div>
        </div>
        <div className="form-success-actions">
          <button
            className="form-btn"
            onClick={() => router.push(`/stream/${success.streamId}`)}
          >
            View Stream →
          </button>
          <button
            className="form-btn-secondary"
            onClick={() => router.push("/dashboard")}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="create-stream-wrap">
      <div className="create-stream-header">
        <h1 className="create-stream-title">Create Payment Stream</h1>
        <p className="create-stream-sub">
          Fund a work agreement on Stellar. Payment unlocks only from npm-tracked active work sessions.
        </p>
      </div>

      {!connected && (
        <div className="create-connect-banner">
          <span>Connect your wallet to create a stream</span>
          <button className="wallet-btn" onClick={openConnectModal} id="create-connect-wallet">
            Connect Freighter
          </button>
        </div>
      )}

      <form className="create-stream-form" onSubmit={handleSubmit} id="create-stream-form">
        <div className="form-section">
          <label className="form-label">Stream Title *</label>
          <input
            className="form-input"
            placeholder="e.g. Smart Contract Audit – Phase 1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            id="stream-title"
          />
        </div>

        <div className="form-section">
          <label className="form-label">Recipient Address *</label>
          <input
            className="form-input form-input--mono"
            placeholder="G…"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            aria-describedby="stream-recipient-help"
            required
            id="stream-recipient"
          />
          <small id="stream-recipient-help" className="form-label-hint">
            Must be different from the connected sender wallet.
          </small>
        </div>

        <div className="form-row">
          <div className="form-section" style={{ flex: 2 }}>
            <label className="form-label">Total Amount *</label>
            <input
              className="form-input"
              type="number"
              placeholder="1000"
              min="0"
              step="any"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              required
              id="stream-total-amount"
            />
          </div>
          <div className="form-section" style={{ flex: 1 }}>
            <label className="form-label">Asset</label>
            <select
              className="form-select"
              value={asset}
              onChange={(e) => setAsset(e.target.value as Asset)}
              id="stream-asset"
            >
              <option value="USDC">USDC</option>
              <option value="XLM">XLM</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-section" style={{ flex: 1 }}>
            <label className="form-label">Duration (days) *</label>
            <input
              className="form-input"
              type="number"
              placeholder="7"
              min="1"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              required
              id="stream-duration"
            />
          </div>
          <div className="form-section" style={{ flex: 1 }}>
            <label className="form-label">
              Rate / second
              <span className="form-label-hint"> (auto-computed)</span>
            </label>
            <input
              className="form-input"
              type="number"
              placeholder={computedRate || "0.00000116"}
              step="any"
              value={ratePerSecond}
              onChange={(e) => setRatePerSecond(e.target.value)}
              id="stream-rate"
            />
          </div>
        </div>

        <div className="form-section">
          <label className="form-label">Category</label>
          <div className="form-category-grid" id="stream-category-grid">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`form-cat-btn ${category === cat ? "selected" : ""}`}
                onClick={() => setCategory(cat)}
                id={`cat-${cat.toLowerCase()}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {computedRate && (
          <div className="form-rate-preview">
            <span>≈ {computedRate} {asset}/sec · {(parseFloat(computedRate) * 3600).toFixed(6)} {asset}/hr</span>
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        <button
          className="form-submit-btn"
          type="submit"
          disabled={loading || !connected}
          id="create-stream-submit"
        >
          {loading ? (
            <span className="form-spinner" />
          ) : (
            "Initialize Stream on Stellar"
          )}
        </button>
      </form>
    </div>
  );
}
