import { listSessions } from "./api.js";
import { readConfig } from "./config.js";
import { findRepositoryRoot } from "./git.js";

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Format an ISO date as "Xh Ym ago" / "Xm ago" / "Xs ago" / "just now". */
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

/** Left-pad a string to a fixed width. */
function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export async function sessionsCommand(): Promise<void> {
  const repositoryRoot = await findRepositoryRoot();

  const config = await readConfig(repositoryRoot);
  if (!config) {
    throw new Error("This repository is not connected to Aven. Run `aven start` first.");
  }

  const { sessions, streamStatus, available, asset } = await listSessions(
    config.dashboardUrl,
    config.streamId,
    config.token,
  );

  process.stdout.write(
    `Stream #${config.streamId}  status: ${streamStatus}  available: ${available} ${asset}\n`,
  );

  if (sessions.length === 0) {
    process.stdout.write("No work sessions found for this stream.\n");
    return;
  }

  // Sort newest first by submittedAt, falling back to updatedAt.
  const sorted = [...sessions].sort((a, b) => {
    const dateA = a.submittedAt ?? a.updatedAt;
    const dateB = b.submittedAt ?? b.updatedAt;
    return Date.parse(dateB) - Date.parse(dateA);
  });

  process.stdout.write("\n");
  for (const session of sorted) {
    const id = session.id.slice(0, 8);
    const statusPadded = pad(session.status, 22);
    const amount = session.requestedAmount ? `${session.requestedAmount} ${asset}` : "–";
    const when = formatAgo(session.updatedAt);
    process.stdout.write(`${id}  ${statusPadded}  ${amount}  ${when}\n`);

    if (session.status === "DISPUTED" && session.disputeReason) {
      const excerpt = session.disputeReason.slice(0, 80);
      process.stdout.write(`  dispute: ${excerpt}\n`);
    } else if (session.status === "RESPONSE_SUBMITTED" && session.workerResponse) {
      const excerpt = session.workerResponse.slice(0, 80);
      process.stdout.write(`  response: ${excerpt}\n`);
    }
  }
  process.stdout.write("\n");
}
