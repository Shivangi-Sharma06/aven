import { readConfig } from "./config.js";
import { findRepositoryRoot } from "./git.js";
import { readSession } from "./session.js";
import {
  isWatcherHealthy,
  WATCHER_HEARTBEAT_STALE_MS,
} from "./watcher.js";

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Formats an ISO timestamp as a human-readable "X ago" string.
 * Examples: "just now", "45s ago", "5m ago", "2h 34m ago".
 */
function formatAgo(isoString: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(isoString)) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m ago` : `${hours}h ago`;
}

/** Format a 7-decimal Stellar amount from activeSeconds * ratePerSecond. */
function estimatePayment(activeSeconds: number, ratePerSecond: string): string {
  // Operate in integer units (1 unit = 10^-7 of the asset).
  const rateMatch = /^(\d+)(?:\.(\d{1,7}))?$/.exec(ratePerSecond.trim());
  if (!rateMatch) return "?";
  const wholeUnits = BigInt(rateMatch[1]) * 10_000_000n;
  const fracStr = (rateMatch[2] ?? "").padEnd(7, "0");
  const fracUnits = BigInt(fracStr);
  const rateUnits = wholeUnits + fracUnits;
  const totalUnits = rateUnits * BigInt(Math.max(0, activeSeconds));
  const whole = totalUnits / 10_000_000n;
  const frac = (totalUnits % 10_000_000n).toString().padStart(7, "0");
  return `${whole}.${frac}`;
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export async function statusCommand(): Promise<void> {
  let repositoryRoot: string;
  try {
    repositoryRoot = await findRepositoryRoot();
  } catch {
    process.stdout.write("Not inside a git repository.\n");
    return;
  }

  const config = await readConfig(repositoryRoot);
  if (!config) {
    process.stdout.write("This repository is not connected to Aven. Run `aven start` first.\n");
    return;
  }

  const session = await readSession(repositoryRoot);
  if (!session) {
    process.stdout.write("No active session. Run `aven start` to begin.\n");
    return;
  }

  if (session.status === "stopped") {
    process.stdout.write("Session is stopped and awaiting submission. Run `aven stop` to submit.\n");
    return;
  }

  // --- Watcher liveness ---
  let watcherStatus: string;
  if (!session.watcherPid) {
    watcherStatus = "Unknown";
  } else if (await isWatcherHealthy(repositoryRoot, session)) {
    watcherStatus = "Running";
  } else {
    watcherStatus = "Dead";
  }

  // --- Last heartbeat ---
  let lastBeat: string;
  if (!session.watcherHeartbeatAt) {
    lastBeat = "no heartbeat recorded";
  } else {
    const ageSeconds = Math.floor((Date.now() - Date.parse(session.watcherHeartbeatAt)) / 1000);
    lastBeat = formatAgo(session.watcherHeartbeatAt);
    if (ageSeconds * 1_000 > WATCHER_HEARTBEAT_STALE_MS) {
      lastBeat += " (stale — watcher may have stopped)";
    }
  }

  // --- Estimated payment ---
  const rate = config.ratePerSecond;
  const asset = config.asset ?? "USDC";
  let rateDisplay: string;
  let estimatedAmount: string;
  if (rate) {
    rateDisplay = `${rate} ${asset}/s`;
    estimatedAmount = `${estimatePayment(session.activeSeconds, rate)} ${asset}`;
  } else {
    rateDisplay = "unknown (run `aven start` again to refresh)";
    estimatedAmount = "unknown";
  }

  process.stdout.write(`\nSESSION\n`);
  process.stdout.write(`  ID          ${session.sessionId}\n`);
  process.stdout.write(`  Stream      #${session.streamId}\n`);
  process.stdout.write(`  Started     ${formatAgo(session.startedAt)}\n`);
  process.stdout.write(`  Branch      ${session.startingBranch}\n`);
  process.stdout.write(`\nACTIVITY\n`);
  process.stdout.write(`  Active      ${session.activeSeconds}s\n`);
  process.stdout.write(`  Idle        ${session.idleSeconds}s\n`);
  process.stdout.write(`  Events      ${session.activityEvents} file changes\n`);
  process.stdout.write(`\nWATCHER\n`);
  process.stdout.write(`  PID         ${session.watcherPid ?? "unknown"}\n`);
  process.stdout.write(`  Status      ${watcherStatus}\n`);
  process.stdout.write(`  Last beat   ${lastBeat}\n`);
  process.stdout.write(`\nRECORDED PAYMENT ESTIMATE\n`);
  process.stdout.write(`  Rate        ${rateDisplay}\n`);
  process.stdout.write(`  Est. amount ${estimatedAmount}\n`);
  process.stdout.write(`\n`);
}
