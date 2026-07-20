import { captureGitState, collectChanges, collectCommits, repositoryIdentifier } from "./git.js";
import { createPrivacyFilter } from "./privacy.js";
import type { AvenConfig, LocalSession, WorkSessionReport } from "./types.js";
import { PACKAGE_VERSION } from "./version.js";

function amountUnits(value: string) {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,7}))?$/.exec(value.trim());
  if (!match) throw new Error("The stream returned an invalid payment amount.");
  return BigInt(match[1]) * 10_000_000n + BigInt((match[2] ?? "").padEnd(7, "0"));
}

function formatAmountUnits(value: bigint) {
  const whole = value / 10_000_000n;
  const fractional = (value % 10_000_000n).toString().padStart(7, "0");
  return `${whole}.${fractional}`;
}

export function calculateAutomaticPayment(
  ratePerSecond: string,
  activeSeconds: number,
  available: string,
) {
  if (!ratePerSecond) throw new Error("The dashboard did not return the stream payment rate.");
  if (!Number.isSafeInteger(activeSeconds) || activeSeconds <= 0) {
    throw new Error(
      "No active work time was recorded. Keep the session running for at least one second before stopping it.",
    );
  }
  const rateUnits = amountUnits(ratePerSecond);
  const availableUnits = amountUnits(available);
  if (availableUnits <= 0n) {
    throw new Error("No unreserved escrow remains on this stream.");
  }
  const sessionUnits = rateUnits * BigInt(activeSeconds);
  const paymentUnits = sessionUnits < availableUnits ? sessionUnits : availableUnits;
  if (paymentUnits <= 0n) {
    throw new Error("The stream rate is too small to pay one tracked second.");
  }
  return formatAmountUnits(paymentUnits);
}

export function calculateCompletionPayment(available: string) {
  const availableUnits = amountUnits(available);
  if (availableUnits <= 0n) {
    throw new Error("No unreserved escrow remains to complete this project.");
  }
  return formatAmountUnits(availableUnits);
}

export async function buildReport(
  repositoryRoot: string,
  config: AvenConfig,
  session: LocalSession,
  message: string,
  payment: { available: string; ratePerSecond: string },
  endedAt = new Date(),
  projectEnded = false,
): Promise<WorkSessionReport> {
  const endingState = await captureGitState(repositoryRoot);
  const privacyFilter = await createPrivacyFilter(repositoryRoot);
  const [changes, commits, repositoryId] = await Promise.all([
    collectChanges(repositoryRoot, session.startingCommit, privacyFilter),
    collectCommits(repositoryRoot, session.startingCommit),
    repositoryIdentifier(repositoryRoot),
  ]);
  const totalSeconds = Math.max(0, Math.floor((endedAt.getTime() - Date.parse(session.startedAt)) / 1000));
  const measured = session.activeSeconds + session.idleSeconds;
  const unmeasured = Math.max(0, totalSeconds - measured);
  const activeSeconds = session.activeSeconds + Math.min(unmeasured, 600);
  const idleSeconds = Math.max(0, totalSeconds - activeSeconds);
  if (!Number.isSafeInteger(activeSeconds) || activeSeconds <= 0) {
    throw new Error(
      "No active work time was recorded. Keep the session running for at least one second before stopping it.",
    );
  }
  const requestedAmount = projectEnded
    ? calculateCompletionPayment(payment.available)
    : calculateAutomaticPayment(
        payment.ratePerSecond,
        activeSeconds,
        payment.available,
      );
  const included = changes.changedFiles.filter((file) => file.includedInVerification);
  const substantive = included.filter((file) => file.category === "source" || file.category === "test");
  const flags: string[] = [];
  if (included.length === 0) flags.push("NO_FILES_CHANGED");
  if (totalSeconds > 0 && idleSeconds / totalSeconds > 0.8) flags.push("HIGH_IDLE_RATIO");
  if (included.length > 0 && substantive.length === 0) flags.push("NO_SUBSTANTIVE_CODE_CHANGES");
  if (changes.additions > 200 && commits.length === 0) flags.push("LARGE_UNCOMMITTED_DIFF");

  return {
    schemaVersion: 1,
    session: {
      sessionId: session.sessionId,
      projectId: config.projectId,
      streamId: config.streamId,
      workerAddress: config.workerAddress,
      startedAt: session.startedAt,
      endedAt: endedAt.toISOString(),
      totalSeconds,
      activeSeconds,
      idleSeconds,
      packageVersion: PACKAGE_VERSION,
      projectEnded,
    },
    repository: {
      repositoryId,
      branchAtStart: session.startingBranch,
      branchAtEnd: endingState.branch,
      startingCommit: session.startingCommit,
      endingCommit: endingState.commit,
      dirtyAtStart: session.dirtyAtStart,
      dirtyAtEnd: endingState.dirty,
    },
    changes: {
      changedFiles: changes.changedFiles,
      additions: changes.additions,
      deletions: changes.deletions,
      commits,
      testsChanged: included.filter((file) => file.category === "test").length,
      documentationFilesChanged: included.filter((file) => file.category === "documentation").length,
      generatedFilesExcluded: changes.changedFiles.filter(
        (file) => !file.includedInVerification && file.category === "generated",
      ).length,
    },
    workerStatement: message ? { message, providedAt: endedAt.toISOString() } : undefined,
    localVerification: {
      verifierVersion: "0.1.0",
      workType: substantive.length > 0 ? "code" : "mixed",
      flags,
      summary: flags.length === 0
        ? "Local static metadata checks found no obvious issues."
        : `Local review found ${flags.length} signal(s): ${flags.join(", ")}.`,
    },
    paymentRequest: {
      requestedAmount,
      asset: config.asset,
      calculation: projectEnded
        ? "remaining_escrow_on_completion"
        : "active_time_x_stream_rate",
      ratePerSecond: payment.ratePerSecond,
      billableSeconds: activeSeconds,
    },
    privacy: {
      profile: "standard",
      excludedFileCount: changes.excludedFileCount,
      secretWarnings: changes.secretWarnings,
      fullFilesIncluded: false,
    },
  };
}

export function printReport(report: WorkSessionReport) {
  const hours = Math.floor(report.session.totalSeconds / 3600);
  const minutes = Math.floor((report.session.totalSeconds % 3600) / 60);
  process.stdout.write(`\nAVEN WORK SESSION\n`);
  process.stdout.write(`Session       ${report.session.sessionId}\n`);
  process.stdout.write(`Duration      ${hours}h ${minutes}m\n`);
  process.stdout.write(`Active / idle ${report.session.activeSeconds}s / ${report.session.idleSeconds}s\n`);
  process.stdout.write(`Files         ${report.changes.changedFiles.length} (${report.privacy.excludedFileCount} excluded)\n`);
  process.stdout.write(`Changes       +${report.changes.additions} / -${report.changes.deletions}\n`);
  process.stdout.write(`Requested     ${report.paymentRequest.requestedAmount} ${report.paymentRequest.asset}\n`);
  process.stdout.write(`Project end   ${report.session.projectEnded ? "YES — CLIENT APPROVAL REQUIRED" : "NO"}\n`);
  process.stdout.write(`Verification  ${report.localVerification.summary}\n`);
  if (report.privacy.secretWarnings > 0) {
    process.stdout.write(`Privacy       ${report.privacy.secretWarnings} sensitive path warning(s); excluded\n`);
  }
  process.stdout.write(`\nChanged files:\n`);
  for (const file of report.changes.changedFiles) {
    process.stdout.write(`  ${file.includedInVerification ? "+" : "×"} ${file.path} (${file.changeType})\n`);
  }
}
