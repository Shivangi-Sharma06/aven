import test from "node:test";
import assert from "node:assert/strict";
import { validateWorkSessionReport } from "../work-session-report-validation.ts";

function report() {
  return {
    schemaVersion: 1 as const,
    session: {
      sessionId: "session-1",
      projectId: "project-1",
      streamId: "1",
      workerAddress: "GWORKER",
      startedAt: "2026-07-22T00:00:00.000Z",
      endedAt: "2026-07-22T00:10:00.000Z",
      totalSeconds: 600,
      activeSeconds: 500,
      idleSeconds: 100,
      packageVersion: "0.2.0",
      projectEnded: true,
    },
    repository: {
      repositoryId: "repo-1",
      branchAtStart: "main",
      branchAtEnd: "main",
      dirtyAtStart: false,
      dirtyAtEnd: false,
      githubRepositoryId: 123,
      githubFullName: "Aven-Stellar/project",
      baselineVerifiedOnRemote: true,
      endingCommitVerifiedOnRemote: true,
    },
    changes: {
      changedFiles: [],
      additions: 0,
      deletions: 0,
      commits: [],
      testsChanged: 0,
      documentationFilesChanged: 0,
      generatedFilesExcluded: 0,
    },
    localVerification: {
      verifierVersion: "0.1.0",
      workType: "code" as const,
      flags: [],
      summary: "ok",
    },
    paymentRequest: { requestedAmount: "1.0000000", asset: "USDC" as const },
    privacy: {
      profile: "standard" as const,
      excludedFileCount: 0,
      secretWarnings: 0,
      fullFilesIncluded: false as const,
    },
    delivery: {
      selectedBranches: [{
        name: "main",
        headCommit: "a".repeat(40),
        verifiedOnRemote: true,
      }],
      includedTags: [],
      repositoryComplete: true,
      verifiedAt: "2026-07-22T00:10:00.000Z",
    },
  };
}

test("accepts valid optional GitHub delivery metadata", () => {
  assert.doesNotThrow(() => validateWorkSessionReport(report()));
});

test("rejects repositoryComplete when a selected branch is unverified", () => {
  const value = report();
  value.delivery.selectedBranches[0].verifiedOnRemote = false;
  assert.throws(() => validateWorkSessionReport(value), /repositoryComplete/);
});

test("rejects malformed delivery commit hashes", () => {
  const value = report();
  value.delivery.selectedBranches[0].headCommit = "not-a-commit";
  assert.throws(() => validateWorkSessionReport(value), /delivery branch/i);
});
