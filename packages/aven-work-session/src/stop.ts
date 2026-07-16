import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { inspectStream, submitReport } from "./api.js";
import { readConfig } from "./config.js";
import { findRepositoryRoot } from "./git.js";
import { buildReport, printReport } from "./report.js";
import { deleteSession, readSession, writeSession } from "./session.js";

export type StopOptions = {
  message?: string;
  amount?: string;
  submit?: boolean;
};

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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

export async function stopCommand(options: StopOptions) {
  const repositoryRoot = await findRepositoryRoot();
  const [config, initialSession] = await Promise.all([
    readConfig(repositoryRoot),
    readSession(repositoryRoot),
  ]);
  if (!config) throw new Error("This repository is not connected to Aven. Run `aven start` first.");
  if (!initialSession) throw new Error("No active Aven work session was found.");
  if (initialSession.watcherPid) {
    try {
      process.kill(initialSession.watcherPid, "SIGTERM");
      await delay(250);
    } catch {
      // A watcher that already stopped does not prevent report generation.
    }
  }
  const session = (await readSession(repositoryRoot)) ?? initialSession;
  session.status = "stopped";
  await writeSession(repositoryRoot, session);

  const stream = await inspectStream(config.dashboardUrl, config.streamId, config.token);
  const message = options.message ?? await question("What did you work on during this session?");
  const amount = options.amount ?? await question(
    `Amount to request in ${config.asset} (current stream earnings: ${stream.earned})`,
  );
  if (!amount) throw new Error("A requested amount is required.");
  const report = await buildReport(repositoryRoot, config, session, message, amount);
  await saveLocalReport(repositoryRoot, report);
  printReport(report);

  let shouldSubmit = options.submit === true;
  if (!options.submit) {
    const confirmation = (await question("Submit this work session to Aven?", "Y")).toLowerCase();
    shouldSubmit = confirmation === "y" || confirmation === "yes";
  }
  if (!shouldSubmit) {
    process.stdout.write("Report saved to .aven/report.json and was not submitted.\n");
    return;
  }

  const result = await submitReport(config, report);
  await deleteSession(repositoryRoot);
  process.stdout.write(`Work session submitted: ${result.sessionId} (${result.status}).\n`);
  process.stdout.write(`Review it in ${config.dashboardUrl}/stream/${config.streamId}.\n`);
}
