import { execFile } from "node:child_process";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { promisify } from "node:util";
import { simpleGit } from "simple-git";
import { inspectStream, submitReport } from "./api.js";
import { readConfig, readGithubConfig } from "./config.js";
import { findRepositoryRoot } from "./git.js";
import { buildReport, printReport } from "./report.js";
import { deleteSession, readSession, sessionPath, writeSession } from "./session.js";
import type { LocalSession, WorkSessionReport } from "./types.js";
import { isProcessAlive, isWatcherHealthy } from "./watcher.js";

const execFileAsync = promisify(execFile);

export type StopOptions = {
  message?: string;
  submit?: boolean;
  ended?: boolean;
};

export function resolveStopTimestamp(
  session: Pick<LocalSession, "status" | "stoppedAt">,
  legacySessionModifiedAt: Date | null,
  now = new Date(),
) {
  if (session.stoppedAt) return new Date(session.stoppedAt);
  if (session.status === "stopped" && legacySessionModifiedAt) return legacySessionModifiedAt;
  return now;
}

async function question(prompt: string, fallback?: string) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const suffix = fallback ? ` [${fallback}]` : "";
    return (await terminal.question(`${prompt}${suffix}: `)).trim() || fallback || "";
  } finally {
    terminal.close();
  }
}

async function saveLocalReport(repositoryRoot: string, report: unknown) {
  const directory = join(repositoryRoot, ".aven");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, "report.json");
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

/**
 * Poll until the process with `pid` is gone or `timeoutMs` elapses.
 * Uses ESRCH (no such process) from `process.kill(pid, 0)` as the exit signal.
 */
async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return !isProcessAlive(pid);
}

export function commandLooksLikeAvenWatcher(
  command: string,
  repositoryRoot: string,
): boolean {
  return command.includes("__watch") && command.includes(repositoryRoot);
}

async function readProcessCommand(pid: number): Promise<string | null> {
  if (process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`,
        ],
        { timeout: 1_000 },
      );
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }
  try {
    const { stdout } = await execFileAsync(
      "ps",
      ["-p", String(pid), "-o", "command="],
      { timeout: 1_000 },
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function isLegacyWatcherProcess(
  repositoryRoot: string,
  pid: number,
): Promise<boolean> {
  const command = await readProcessCommand(pid);
  return command !== null && commandLooksLikeAvenWatcher(command, repositoryRoot);
}

export async function stopCommand(options: StopOptions) {
  const repositoryRoot = await findRepositoryRoot();
  const [config, initialSession] = await Promise.all([
    readConfig(repositoryRoot),
    readSession(repositoryRoot),
  ]);
  if (!config) throw new Error("This repository is not connected to Aven. Run `aven start` first.");
  if (!initialSession) throw new Error("No active Aven work session was found.");
  let legacySessionModifiedAt: Date | null = null;
  if (initialSession.status === "stopped" && !initialSession.stoppedAt) {
    legacySessionModifiedAt = await stat(sessionPath(repositoryRoot))
      .then((details) => details.mtime)
      .catch(() => null);
  }

  if (initialSession.watcherPid) {
    const pid = initialSession.watcherPid;
    const alive = isProcessAlive(pid);
    if (alive) {
      const verified =
        await isWatcherHealthy(repositoryRoot, initialSession) ||
        await isLegacyWatcherProcess(repositoryRoot, pid);
      if (!verified) {
        throw new Error(
          `Watcher PID ${pid} is running, but Aven cannot verify that it owns the process. ` +
          "No signal was sent. Stop that watcher manually, then run `aven stop` again.",
        );
      }
      try {
        process.kill(pid, "SIGTERM");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
      if (!await waitForExit(pid, 3_000)) {
        throw new Error(
          `Watcher PID ${pid} did not exit within 3 seconds. No report was generated.`,
        );
      }
    }
  }

  const session = (await readSession(repositoryRoot)) ?? initialSession;
  const stoppedAt = resolveStopTimestamp(session, legacySessionModifiedAt);
  session.status = "stopped";
  session.stoppedAt = stoppedAt.toISOString();
  await writeSession(repositoryRoot, session);

  const stream = await inspectStream(config.dashboardUrl, config.streamId, config.token);
  const message = options.message ?? await question("What did you work on during this session?");
  let report = await buildReport(
    repositoryRoot,
    config,
    session,
    message,
    {
      available: stream.available,
      ratePerSecond: stream.ratePerSecond,
    },
    stoppedAt,
    options.ended === true,
  );

  // ── GitHub delivery tracking (when --ended) ────────────────────────────────
  if (options.ended === true) {
    try {
      const githubConfig = await readGithubConfig(repositoryRoot);
      if (githubConfig) {
        const git = simpleGit(repositoryRoot);
        // List local branches
        const branchSummary = await git.branchLocal();
        const localBranches = branchSummary.all;
        const currentBranch = branchSummary.current;

        // Prompt worker to select delivery branches
        const terminal = createInterface({ input: process.stdin, output: process.stdout });
        process.stdout.write("\nSelect branches to include in the delivery:\n");
        localBranches.forEach((b, i) => {
          const current = b === currentBranch ? " (current)" : "";
          process.stdout.write(`  [${i + 1}] ${b}${current}\n`);
        });
        process.stdout.write(`  [a] All branches\n`);
        const answer = (await terminal.question("Enter branch numbers (comma-separated) or 'a' for all: ")).trim();
        terminal.close();

        let selectedNames: string[];
        if (answer.toLowerCase() === "a") {
          selectedNames = localBranches;
        } else {
          const indices = answer.split(",").map((s) => parseInt(s.trim(), 10) - 1);
          selectedNames = indices
            .filter((i) => i >= 0 && i < localBranches.length)
            .map((i) => localBranches[i]);
        }

        if (selectedNames.length === 0) selectedNames = [currentBranch];

        // Resolve head commit and verify each branch on GitHub via the dashboard API
        const deliveryBranches: WorkSessionReport["delivery"] extends undefined ? never : NonNullable<WorkSessionReport["delivery"]>["selectedBranches"] = [];
        let allVerified = true;

        for (const branchName of selectedNames) {
          let headCommit = "";
          try {
            const log = await git.log({ maxCount: 1, from: branchName });
            headCommit = log.latest?.hash ?? "";
          } catch { /* ignore */ }

          // Verify on GitHub via dashboard API
          let verifiedOnRemote = false;
          try {
            const checkUrl = `${config.dashboardUrl}/api/streams/${config.streamId}/repository`;
            const resp = await fetch(checkUrl, {
              headers: { authorization: `Bearer ${config.token}` },
            });
            if (resp.ok) {
              const repoData = await resp.json() as { fullName?: string };
              if (repoData.fullName) {
                const verifyUrl = `${config.dashboardUrl}/api/github/verify-branch`;
                const vResp = await fetch(verifyUrl, {
                  method: "POST",
                  headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
                  body: JSON.stringify({ fullName: repoData.fullName, branch: branchName }),
                });
                if (vResp.ok) {
                  const vData = await vResp.json() as { exists?: boolean };
                  verifiedOnRemote = vData.exists === true;
                }
              }
            }
          } catch { /* offline — mark as not verified */ }

          if (!verifiedOnRemote) {
            process.stdout.write(`  ⚠ Branch '${branchName}' could not be verified on the remote repository.\n`);
            allVerified = false;
          }
          deliveryBranches.push({ name: branchName, headCommit, verifiedOnRemote });
        }

        if (!allVerified) {
          process.stdout.write(
            "One or more selected branches were not found on the remote.\n" +
            "Push them before requesting final payment transfer.\n",
          );
        }

        // Attach delivery tracking to the report
        const delivery: NonNullable<WorkSessionReport["delivery"]> = {
          selectedBranches: deliveryBranches,
          includedTags: [],
          repositoryComplete: allVerified,
          verifiedAt: new Date().toISOString(),
        };
        report = { ...report, delivery };
      }
    } catch (error) {
      // Delivery tracking is best-effort — do not fail the stop command
      process.stderr.write(`GitHub delivery tracking unavailable: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
  await saveLocalReport(repositoryRoot, report);
  printReport(report);
  process.stdout.write(
    report.session.projectEnded
      ? "Project completion requested. Aven will calculate the remaining settlement on the server.\n"
      : `Payment was calculated from ${report.session.activeSeconds}s of tracked active time at the stream rate.\n`,
  );

  let shouldSubmit = options.submit === true;
  if (!options.submit) {
    const prompt = report.session.projectEnded
      ? "Submit this FINAL project session to Aven?"
      : "Submit this work session to Aven?";
    const confirmation = (await question(prompt, "Y")).toLowerCase();
    shouldSubmit = confirmation === "y" || confirmation === "yes";
  }
  if (!shouldSubmit) {
    process.stdout.write("Report saved to .aven/report.json and was not submitted.\n");
    return;
  }

  const submittedReport = {
    ...report,
    changes: {
      ...report.changes,
      changedFiles: report.changes.changedFiles.filter((file) => file.includedInVerification),
    },
  };
  const result = await submitReport(config, submittedReport);
  await deleteSession(repositoryRoot);
  process.stdout.write(`Work session submitted: ${result.sessionId} (${result.status}).\n`);
  process.stdout.write(`Review it in ${config.dashboardUrl}/stream/${config.streamId}.\n`);
}
