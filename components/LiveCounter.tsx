"use client";

import { useEffect, useMemo, useState } from "react";
import { StreamObject } from "@/lib/stellar";

/**
 * LiveCounter — shows a live ticking counter for an active stream's earned amount.
 * Uses ratePerLedger and approximates elapsed ledgers from real time.
 * (5 seconds/ledger on testnet)
 */
const SECONDS_PER_LEDGER = 5;

function computeEarnedLocal(stream: StreamObject, nowMs: number): number {
  if (stream.status !== "active") {
    return stream.totalWithdrawn;
  }
  const elapsedSeconds = (nowMs / 1000) - (stream.startLedger * SECONDS_PER_LEDGER);
  const elapsedLedgers = Math.max(0, Math.floor(elapsedSeconds / SECONDS_PER_LEDGER));
  const earned = Math.min(stream.totalDeposited, elapsedLedgers * stream.ratePerLedger);
  return Math.max(0, earned - stream.totalWithdrawn);
}

export function LiveCounter({
  stream,
  suffix = true,
  intervalMs = 1000,
  className,
}: {
  stream: StreamObject;
  suffix?: boolean;
  intervalMs?: number;
  className?: string;
}) {
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    if (stream.status !== "active") return;
    const id = window.setInterval(() => setTick(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, stream.status]);

  const earned = useMemo(() => computeEarnedLocal(stream, tick), [stream, tick]);

  return (
    <span className={`live-counter ${className ?? ""}`}>
      {earned.toFixed(6)}
      {suffix ? ` ${stream.asset}` : ""}
    </span>
  );
}
