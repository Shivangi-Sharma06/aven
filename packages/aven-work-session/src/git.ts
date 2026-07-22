import { createHash } from "node:crypto";
import { basename, relative } from "node:path";
import { simpleGit } from "simple-git";
import { categoryForPath, languageForPath } from "./privacy.js";
import type { CommitSummary, FileChangeSummary } from "./types.js";

export async function findRepositoryRoot(cwd = process.cwd()) {
  try {
    return (await simpleGit(cwd).revparse(["--show-toplevel"])).trim();
  } catch {
    throw new Error("Run Aven inside a Git repository.");
  }
}

export async function captureGitState(repositoryRoot: string) {
  const git = simpleGit(repositoryRoot);
  const status = await git.status();
  const branch = status.current ?? (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
  let commit: string | undefined;
  try {
    commit = (await git.revparse(["HEAD"])).trim();
  } catch {
    commit = undefined;
  }
  return {
    branch,
    commit,
    dirty: !status.isClean(),
    /** Files present on disk but not tracked by Git at this moment. */
    untrackedFiles: status.not_added,
  };
}

function parseNameStatus(raw: string) {
  const statuses = new Map<string, FileChangeSummary["changeType"]>();
  for (const line of raw.split(/\r?\n/).filter(Boolean)) {
    const [status, firstPath, secondPath] = line.split("\t");
    const path = secondPath ?? firstPath;
    if (!path) continue;
    const changeType = status.startsWith("A")
      ? "created"
      : status.startsWith("D")
        ? "deleted"
        : status.startsWith("R")
          ? "renamed"
          : "modified";
    statuses.set(path, changeType);
  }
  return statuses;
}

export async function collectChanges(
  repositoryRoot: string,
  startingCommit: string | undefined,
  excluded: (path: string) => boolean,
  startingUntrackedFiles: readonly string[] = [],
) {
  if (!startingCommit) {
    // No deterministic baseline — return empty rather than reporting every
    // file in the working tree as "created".
    return { changedFiles: [], additions: 0, deletions: 0, excludedFileCount: 0, secretWarnings: 0 };
  }

  const git = simpleGit(repositoryRoot);
  const diffArguments = [startingCommit, "HEAD", "--"];
  const [summary, nameStatus] = await Promise.all([
    git.diffSummary(diffArguments),
    git.diff(["--name-status", ...diffArguments]),
  ]);
  const statuses = parseNameStatus(nameStatus);

  // Only include untracked files that did NOT exist at the starting commit
  // AND were not already on disk when the session started.
  //
  // `startingUntrackedFiles` is the set of `git status --porcelain` "??"
  // paths captured when `aven start` ran.  Any path in that set that is
  // still untracked at session end was pre-existing and must not be
  // reported as a session creation.
  const preExisting = new Set(startingUntrackedFiles);
  const status = await git.status();
  for (const path of status.not_added) {
    if (preExisting.has(path)) continue; // pre-existed before the session
    statuses.set(path, "created");
  }

  const stats = new Map(summary.files.map((file) => [file.file, file]));
  const changedFiles: FileChangeSummary[] = [];
  let excludedFileCount = 0;
  let secretWarnings = 0;
  for (const [path, changeType] of statuses) {
    const isExcluded = excluded(path);
    if (isExcluded) {
      excludedFileCount += 1;
      if (/secret|credential|password|\.env|\.pem|\.key/i.test(path)) secretWarnings += 1;
    }
    const stat = stats.get(path);
    const additions = stat && "insertions" in stat ? stat.insertions : 0;
    const deletions = stat && "deletions" in stat ? stat.deletions : 0;
    changedFiles.push({
      path,
      language: languageForPath(path),
      changeType,
      additions,
      deletions,
      category: categoryForPath(path),
      includedInVerification: !isExcluded,
      excludedReason: isExcluded ? "Excluded by Git/Aven privacy rules." : undefined,
    });
  }

  const included = changedFiles.filter((file) => file.includedInVerification);
  return {
    changedFiles,
    additions: included.reduce((total, file) => total + (file.additions ?? 0), 0),
    deletions: included.reduce((total, file) => total + (file.deletions ?? 0), 0),
    excludedFileCount,
    secretWarnings,
  };
}

export async function collectCommits(repositoryRoot: string, startingCommit?: string) {
  if (!startingCommit) return [];
  const git = simpleGit(repositoryRoot);
  const endingCommit = (await git.revparse(["HEAD"])).trim();
  if (endingCommit === startingCommit) return [];
  const log = await git.log({ from: startingCommit, to: endingCommit });
  return log.all.map<CommitSummary>((commit) => ({
    hash: commit.hash,
    message: commit.message,
    timestamp: commit.date,
  }));
}

export async function repositoryIdentifier(repositoryRoot: string) {
  const git = simpleGit(repositoryRoot);
  let source = repositoryRoot;
  try {
    source = (await git.getRemotes(true))[0]?.refs.fetch || repositoryRoot;
  } catch {
    // A local-only repository is identified without sending its absolute path.
  }
  return `${basename(repositoryRoot)}-${createHash("sha256").update(source).digest("hex").slice(0, 12)}`;
}

export function relativeRepositoryPath(repositoryRoot: string, absolutePath: string) {
  return relative(repositoryRoot, absolutePath).replaceAll("\\", "/");
}
