import { StreamObject } from "@/lib/stellar";

/**
 * Displays escrow remaining. Work-session payment is measured by the npm
 * package and must never be inferred from browser or ledger time.
 */
export function LiveCounter({
  stream,
  suffix = true,
  className,
}: {
  stream: StreamObject;
  suffix?: boolean;
  className?: string;
}) {
  const remaining = Math.max(0, stream.totalDeposited - stream.totalWithdrawn);

  return (
    <span className={`live-counter ${className ?? ""}`}>
      {remaining.toFixed(6)}
      {suffix ? ` ${stream.asset}` : ""}
    </span>
  );
}
