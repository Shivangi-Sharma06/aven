import type { WorkSessionReport } from "./work-session";

export type VerificationResult = {
  flags: string[];
  summary: string;
  workType: "code" | "writing" | "image" | "mixed";
};

export function verifyReport(report: WorkSessionReport): VerificationResult {
  const flags: string[] = [];

  if (report.changes.changedFiles.length === 0) flags.push("NO_FILES_CHANGED");

  if (report.session.activeSeconds < 300 && Number(report.paymentRequest.requestedAmount) > 10) {
    flags.push("LOW_ACTIVITY_FOR_AMOUNT");
  }

  if (
    report.session.totalSeconds > 0 &&
    report.session.idleSeconds / report.session.totalSeconds > 0.8
  ) {
    flags.push("HIGH_IDLE_RATIO");
  }

  const substantive = report.changes.changedFiles.filter(
    (file) => file.category === "source" || file.category === "test",
  );
  if (report.changes.changedFiles.length > 0 && substantive.length === 0) {
    flags.push("NO_SUBSTANTIVE_CODE_CHANGES");
  }

  if (report.changes.additions > 200 && report.changes.commits.length === 0) {
    flags.push("LARGE_UNCOMMITTED_DIFF");
  }

  const categories = new Set(report.changes.changedFiles.map((file) => file.category));
  const workType = categories.has("source") || categories.has("test")
    ? "code"
    : categories.size === 1 && categories.has("documentation")
      ? "writing"
      : categories.size === 1 && categories.has("asset")
        ? "image"
        : "mixed";

  const summary = flags.length === 0
    ? "No issues detected in this submission."
    : `${flags.length} signal(s) flagged: ${flags.join(", ")}. Client review recommended.`;

  return { flags, summary, workType };
}
