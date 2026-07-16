#!/usr/bin/env node

import { Command } from "commander";
import { runActivityWatcher } from "./activity.js";
import { startCommand } from "./start.js";
import { stopCommand } from "./stop.js";

async function main() {
  if (process.argv[2] === "__watch") {
    const repositoryRoot = process.argv[3];
    if (!repositoryRoot) throw new Error("Watcher repository path is missing.");
    await runActivityWatcher(repositoryRoot);
    return;
  }

  const program = new Command();
  program
    .name("aven")
    .description("Record a privacy-conscious work session for an Aven payment stream.")
    .version("0.1.0");

  program
    .command("start")
    .description("Start recording project activity for the configured Aven stream.")
    .option("--stream <streamId>", "Aven stream ID")
    .option("--dashboard <url>", "Aven dashboard URL")
    .option("--non-interactive", "Skip the collection confirmation")
    .action(startCommand);

  program
    .command("stop")
    .description("Stop the session, generate a report, and optionally submit it.")
    .option("--message <text>", "Worker statement")
    .option("--submit", "Submit without an additional confirmation")
    .action(stopCommand);

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  process.stderr.write(`Aven: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
