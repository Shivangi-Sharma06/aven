import type { WorkSessionReport } from "./work-session";

const AMOUNT_PATTERN = /^(0|[1-9]\d*)(?:\.(\d{1,7}))?$/;

export function validateWorkSessionReport(value: unknown): asserts value is WorkSessionReport {
  if (!value || typeof value !== "object") throw new Error("A work-session report is required.");
  const report = value as Partial<WorkSessionReport>;
  if (report.schemaVersion !== 1) throw new Error("schemaVersion must be 1.");
  if (!report.session || !report.repository || !report.changes || !report.paymentRequest || !report.privacy) {
    throw new Error("The work-session report is incomplete.");
  }
  if (!report.session.sessionId?.trim() || !report.session.streamId?.trim()) {
    throw new Error("Session and stream identifiers are required.");
  }
  if (!report.session.workerAddress?.trim()) throw new Error("workerAddress is required.");
  if (Date.parse(report.session.startedAt) >= Date.parse(report.session.endedAt)) {
    throw new Error("Session start time must be before its end time.");
  }
  if (
    !Number.isFinite(report.session.totalSeconds) ||
    !Number.isFinite(report.session.activeSeconds) ||
    !Number.isFinite(report.session.idleSeconds) ||
    report.session.totalSeconds < 0 ||
    report.session.activeSeconds < 0 ||
    report.session.idleSeconds < 0
  ) {
    throw new Error("Session durations must be non-negative numbers.");
  }
  if (
    !Number.isSafeInteger(report.session.activeSeconds) ||
    !Number.isSafeInteger(report.session.totalSeconds) ||
    report.session.activeSeconds > report.session.totalSeconds
  ) {
    throw new Error("Active session time must be a whole number no greater than total session time.");
  }
  if (report.session.projectEnded !== undefined && typeof report.session.projectEnded !== "boolean") {
    throw new Error("projectEnded must be a boolean when provided.");
  }
  if (!Array.isArray(report.changes.changedFiles) || !Array.isArray(report.changes.commits)) {
    throw new Error("Changed files and commits must be arrays.");
  }
  if (report.changes.changedFiles.length > 5_000) throw new Error("The report contains too many files.");

  const repository = report.repository;
  if (
    (repository.githubRepositoryId !== undefined &&
      (!Number.isSafeInteger(repository.githubRepositoryId) || repository.githubRepositoryId <= 0)) ||
    (repository.githubFullName !== undefined && typeof repository.githubFullName !== "string") ||
    (repository.compareUrl !== undefined && typeof repository.compareUrl !== "string") ||
    (repository.baselineVerifiedOnRemote !== undefined &&
      typeof repository.baselineVerifiedOnRemote !== "boolean") ||
    (repository.endingCommitVerifiedOnRemote !== undefined &&
      typeof repository.endingCommitVerifiedOnRemote !== "boolean")
  ) {
    throw new Error("The optional GitHub repository metadata is invalid.");
  }

  if (report.delivery !== undefined) {
    if (
      !Array.isArray(report.delivery.selectedBranches) ||
      report.delivery.selectedBranches.length > 100 ||
      !Array.isArray(report.delivery.includedTags) ||
      typeof report.delivery.repositoryComplete !== "boolean" ||
      (report.delivery.verifiedAt !== undefined && !Number.isFinite(Date.parse(report.delivery.verifiedAt)))
    ) {
      throw new Error("The delivery metadata is invalid.");
    }
    for (const branch of report.delivery.selectedBranches) {
      if (
        !branch ||
        typeof branch.name !== "string" ||
        !branch.name.trim() ||
        typeof branch.headCommit !== "string" ||
        !/^[a-f\d]{40}$/i.test(branch.headCommit) ||
        typeof branch.verifiedOnRemote !== "boolean"
      ) {
        throw new Error("A delivery branch is invalid.");
      }
    }
    if (!report.delivery.includedTags.every((tag) => typeof tag === "string")) {
      throw new Error("Delivery tags must be strings.");
    }
    if (
      report.delivery.repositoryComplete !==
      (report.delivery.selectedBranches.length > 0 &&
        report.delivery.selectedBranches.every((branch) => branch.verifiedOnRemote))
    ) {
      throw new Error("repositoryComplete must reflect all selected branch verification results.");
    }
  }

  if (!AMOUNT_PATTERN.test(report.paymentRequest.requestedAmount)) {
    throw new Error("Amount must be a non-negative decimal string with at most 7 decimal places.");
  }
  if (report.paymentRequest.asset !== "USDC" && report.paymentRequest.asset !== "XLM") {
    throw new Error("Unsupported payment asset.");
  }
  if (report.privacy.fullFilesIncluded !== false) {
    throw new Error("Full file contents are not accepted by this endpoint.");
  }
}
