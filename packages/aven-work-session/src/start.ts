import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { basename } from "node:path";
import { authorizeCli } from "./auth.js";
import { getGithubRepository, inspectStream } from "./api.js";
import { readConfig, writeConfig } from "./config.js";
import { captureGitState, findRepositoryRoot } from "./git.js";
import { ensureAvenIgnore } from "./privacy.js";
import { deleteSession, readSession, writeSession } from "./session.js";
import type { AvenConfig, LocalSession } from "./types.js";
import {
  isWatcherHealthy,
  removeWatcherSentinel,
} from "./watcher.js";

export type StartOptions = {
  stream?: string;
  dashboard?: string;
  nonInteractive?: boolean;
};

export async function ensureAvenRemote(
  repositoryRoot: string,
  github: NonNullable<AvenConfig["github"]>,
) {
  const git = (await import("simple-git")).simpleGit(repositoryRoot);
  const remote = (await git.getRemotes(true)).find((candidate) => candidate.name === "aven");
  const acceptedUrls = new Set([github.sshUrl, github.cloneUrl]);
  if (!remote) {
    process.stdout.write(`git remote add aven ${github.sshUrl}\n`);
    await git.addRemote("aven", github.sshUrl);
    return;
  }
  if (!acceptedUrls.has(remote.refs.fetch) || !acceptedUrls.has(remote.refs.push)) {
    throw new Error(
      `The existing 'aven' remote points to ${remote.refs.fetch || remote.refs.push}, not ${github.fullName}. ` +
      "Remove or rename it yourself, then run `aven start` again. Aven never overwrites remotes.",
    );
  }
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

async function firstTimeSetup(repositoryRoot: string, options: StartOptions): Promise<AvenConfig> {
  const dashboardUrl = (options.dashboard ?? await question("Aven dashboard URL", "http://localhost:3000"))
    .replace(/\/$/, "");
  const streamId = options.stream ?? await question("Aven stream ID");
  if (!/^\d+$/.test(streamId)) throw new Error("Stream ID must contain only digits.");
  process.stdout.write("Authorize the worker wallet in the browser. The CLI never receives a wallet secret.\n");
  const authorization = await authorizeCli(dashboardUrl);
  const stream = await inspectStream(dashboardUrl, streamId, authorization.token);
  if (!stream.asset || !stream.workerAddress) throw new Error("The dashboard did not return stream metadata.");
  if (stream.workerAddress.toUpperCase() !== authorization.walletAddress.toUpperCase()) {
    throw new Error("The authorized wallet is not this stream's recipient.");
  }
  const config: AvenConfig = {
    version: 1,
    dashboardUrl,
    projectId: `${basename(repositoryRoot)}-${streamId}`,
    contractId: stream.contractId,
    streamId,
    workerAddress: authorization.walletAddress,
    asset: stream.asset,
    token: authorization.token,
    ratePerSecond: stream.ratePerSecond,
  };
  await writeConfig(repositoryRoot, config);
  return config;
}

export async function startCommand(options: StartOptions) {
  const repositoryRoot = await findRepositoryRoot();
  await ensureAvenIgnore(repositoryRoot);
  const existingSession = await readSession(repositoryRoot);
  if (existingSession) {
    if (existingSession.status === "stopped") {
      throw new Error(
        "A previous Aven session is awaiting submission. Run `aven stop` again before starting another.",
      );
    }

    // Active session — check whether its watcher is still actually running.
    const watcherAlive = await isWatcherHealthy(repositoryRoot, existingSession);

    if (watcherAlive) {
      throw new Error(
        "An Aven work session already exists in this repository. Stop it before starting another.",
      );
    }

    // Dead watcher — inform the user and let them decide what to do.
    const started = existingSession.startedAt;
    const active = existingSession.activeSeconds;
    const streamId = existingSession.streamId;
    process.stdout.write(
      `A session from ${started} was interrupted (watcher is no longer running).\n` +
      `It recorded ${active}s of active time on stream #${streamId}.\n` +
      `Run \`aven stop\` to generate a report and submit it, or delete .aven/session.json to discard it.\n`,
    );
    throw new Error("Interrupted session detected. Resolve it before starting a new one.");
  }

  let config = await readConfig(repositoryRoot);
  if (config) {
    // If the user explicitly passed a --dashboard URL that differs from the
    // saved config, prompt them to reset.  Silently ignoring the flag would
    // cause confusing mis-configuration between environments.
    const dashboardChanged =
      options.dashboard &&
      options.dashboard.replace(/\/$/, "") !== config.dashboardUrl.replace(/\/$/, "");
    const streamChanged = options.stream && config.streamId !== options.stream;
    if (dashboardChanged || streamChanged || !config.contractId) {
      if (options.nonInteractive) {
        const reason = dashboardChanged
          ? `--dashboard changed from ${config.dashboardUrl} to ${options.dashboard}. Delete .aven/config.json to reset.`
          : streamChanged
            ? `--stream changed from ${config.streamId} to ${options.stream}. Delete .aven/config.json to reset.`
            : "The saved config is missing a contract ID.";
        throw new Error(reason);
      }
      if (dashboardChanged) {
        process.stdout.write(
          `Dashboard URL changed from ${config.dashboardUrl} to ${options.dashboard}.\n`,
        );
      } else if (streamChanged) {
        process.stdout.write(
          `Stream ID changed from ${config.streamId} to ${options.stream}.\n`,
        );
      }
      const confirm = (await question("Reset saved config and re-authorize?", "Y")).toLowerCase();
      if (confirm !== "y" && confirm !== "yes") {
        process.stdout.write("Keeping existing config. Pass --stream or --dashboard to force a reset.\n");
        config = null; // Proceed with firstTimeSetup using existing dashboard URL.
      } else {
        config = null;
      }
    }
  }
  if (!config) config = await firstTimeSetup(repositoryRoot, options);
  try {
    const stream = await inspectStream(config.dashboardUrl, config.streamId, config.token);
    if (!stream.contractId || stream.contractId !== config.contractId) {
      throw new Error("The configured stream belongs to a different contract deployment.");
    }
    if (stream.workerAddress.toUpperCase() !== config.workerAddress.toUpperCase()) {
      throw new Error("The configured wallet is no longer the stream recipient.");
    }
    if (stream.status !== "active" && stream.status !== "paused") {
      throw new Error(`The configured stream is ${stream.status}.`);
    }
    // Refresh ratePerSecond in config so offline estimates stay accurate.
    if (stream.ratePerSecond && stream.ratePerSecond !== config.ratePerSecond) {
      config.ratePerSecond = stream.ratePerSecond;
      await writeConfig(repositoryRoot, config);
    }
  } catch (error) {
    if (options.nonInteractive) throw error;
    process.stdout.write("The saved CLI authorization is unavailable. Authorizing again…\n");
    config = await firstTimeSetup(repositoryRoot, { ...options, stream: config.streamId, dashboard: config.dashboardUrl });
  }

  const github = await getGithubRepository(config.dashboardUrl, config.streamId, config.token);
  if (github) {
    config.github = github;
    await writeConfig(repositoryRoot, config);
    await ensureAvenRemote(repositoryRoot, github);
  }

  const git = await captureGitState(repositoryRoot);
  if (!git.commit) {
    process.stderr.write(
      "No commits found. Aven cannot track changes without a starting commit.\n" +
      "Please make an initial commit before running `aven start`.\n",
    );
    process.exit(1);
  }
  process.stdout.write(`\nAven will collect:\n`);
  process.stdout.write(`  • relative file paths and change types\n`);
  process.stdout.write(`  • Git branch, commit, and diff statistics\n`);
  process.stdout.write(`  • session, active, and idle duration\n`);
  process.stdout.write(`\nAven will not collect file contents, keystrokes, screenshots, wallet secrets, or files excluded by .gitignore/.avenignore.\n\n`);
  if (!options.nonInteractive) {
    const confirmation = (await question("Start this work session?", "Y")).toLowerCase();
    if (confirmation !== "y" && confirmation !== "yes") return;
  }

  const now = new Date().toISOString();
  const session: LocalSession = {
    version: 1,
    sessionId: randomUUID(),
    projectId: config.projectId,
    streamId: config.streamId,
    workerAddress: config.workerAddress,
    status: "active",
    startedAt: now,
    startingCommit: git.commit,
    startingBranch: git.branch,
    dirtyAtStart: git.dirty,
    lastActivityAt: now,
    activeSeconds: 0,
    idleSeconds: 0,
    activityEvents: 0,
    startingUntrackedFiles: git.untrackedFiles,
  };
  await writeSession(repositoryRoot, session);

  const child = spawn(process.execPath, [process.argv[1], "__watch", repositoryRoot], {
    detached: true,
    stdio: "ignore",
    cwd: repositoryRoot,
  });
  const watcherState: { spawnError?: Error } = {};
  child.once("error", (error) => {
    watcherState.spawnError = error;
  });
  if (!child.pid) {
    await deleteSession(repositoryRoot);
    throw new Error("The activity watcher could not be started.");
  }
  session.watcherPid = child.pid;
  await writeSession(repositoryRoot, session);
  const cleanupFailedStart = async () => {
    try {
      process.kill(child.pid!, "SIGTERM");
    } catch {
      // The failed watcher may already have exited.
    }
    await removeWatcherSentinel(repositoryRoot, {
      pid: child.pid!,
      sessionId: session.sessionId,
    }).catch(() => undefined);
    await deleteSession(repositoryRoot);
  };
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const latestSession = await readSession(repositoryRoot);
    if (
      latestSession &&
      latestSession.sessionId === session.sessionId &&
      await isWatcherHealthy(repositoryRoot, latestSession)
    ) {
      session.watcherHeartbeatAt = latestSession.watcherHeartbeatAt;
      break;
    }
    if (watcherState.spawnError) {
      await cleanupFailedStart();
      throw new Error(
        `The activity watcher could not be started: ${watcherState.spawnError.message}`,
      );
    }
    if (child.exitCode !== null) {
      await cleanupFailedStart();
      throw new Error("The activity watcher exited before it became ready.");
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!session.watcherHeartbeatAt) {
    await cleanupFailedStart();
    throw new Error("The activity watcher did not become ready within 3 seconds.");
  }
  child.unref();
  process.stdout.write(`Aven session ${session.sessionId} started for stream #${config.streamId}.\n`);
  process.stdout.write(`Run \`npx aven-stellar stop\` when this work period is finished.\n`);
}
