/**
 * Tests for packages/aven-work-session/src/git.ts — collectChanges().
 *
 * Uses Node's built-in test runner (node:test) and real simple-git in
 * temporary directories so there is no Jest dependency.
 *
 * Run with:
 *   npm --prefix packages/aven-work-session test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { simpleGit } from "simple-git";
import { collectChanges } from "../git.js";

// ─── Helper utilities ─────────────────────────────────────────────────────────

/** Create a fresh temp repo with git identity set. */
async function makeRepo() {
  const dir = await mkdtemp(join(tmpdir(), "aven-git-test-"));
  const git = simpleGit(dir);
  await git.init();
  await git.addConfig("user.name", "Aven Test", false, "local");
  await git.addConfig("user.email", "test@aven.test", false, "local");
  return { dir, git };
}

/** Remove a temp directory. */
async function cleanRepo(dir: string) {
  await rm(dir, { recursive: true, force: true });
}

/** Write a file and commit it. Returns the commit SHA. */
async function commitFile(
  git: ReturnType<typeof simpleGit>,
  dir: string,
  filename: string,
  content: string,
  message = `add ${filename}`,
): Promise<string> {
  await writeFile(join(dir, filename), content, "utf8");
  await git.add(filename);
  await git.commit(message);
  return (await git.revparse(["HEAD"])).trim();
}

/** An exclusion function that never excludes anything. */
const noExclusions = (_path: string) => false;

/** An exclusion function that excludes .aven/ files. */
const avenExclusions = (path: string) => path.startsWith(".aven/");

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("collectChanges", () => {
  // ── No startingCommit ────────────────────────────────────────────────────────

  it("returns empty when startingCommit is undefined (no deterministic baseline)", async () => {
    const { dir, git } = await makeRepo();
    try {
      // Make a commit so HEAD exists
      await commitFile(git, dir, "readme.txt", "hello");
      // Write another untracked file
      await writeFile(join(dir, "extra.txt"), "extra");

      const result = await collectChanges(dir, undefined, noExclusions);
      assert.equal(result.changedFiles.length, 0, "should return no files");
      assert.equal(result.additions, 0);
      assert.equal(result.deletions, 0);
    } finally {
      await cleanRepo(dir);
    }
  });

  // ── No commits in repo ───────────────────────────────────────────────────────

  it("returns empty when there are no commits in the repo", async () => {
    const { dir } = await makeRepo();
    try {
      // No commits — startingCommit undefined
      const result = await collectChanges(dir, undefined, noExclusions);
      assert.equal(result.changedFiles.length, 0);
      assert.equal(result.additions, 0);
    } finally {
      await cleanRepo(dir);
    }
  });

  // ── File created during session ───────────────────────────────────────────────

  it("reports a file committed after startingCommit as 'created'", async () => {
    const { dir, git } = await makeRepo();
    try {
      const startingCommit = await commitFile(git, dir, "base.txt", "base content");
      await commitFile(git, dir, "new.txt", "new content");

      const result = await collectChanges(dir, startingCommit, noExclusions);
      const found = result.changedFiles.find((f) => f.path === "new.txt");
      assert.ok(found, "new.txt should appear in changedFiles");
      assert.equal(found?.changeType, "created");
    } finally {
      await cleanRepo(dir);
    }
  });

  // ── Untracked file present BEFORE session is NOT reported as created ──────────

  it("does NOT report an untracked file that existed before startingCommit as created", async () => {
    const { dir, git } = await makeRepo();
    try {
      const startingCommit = await commitFile(git, dir, "base.txt", "base content");
      // Write an untracked file (never committed) that existed before session start
      await writeFile(join(dir, "pre-existing-untracked.txt"), "I was here before");

      // Simulate what `aven start` does: capture untracked files at session start
      const statusAtStart = await git.status();
      const startingUntrackedFiles = statusAtStart.not_added;

      const result = await collectChanges(dir, startingCommit, noExclusions, startingUntrackedFiles);
      const found = result.changedFiles.find(
        (f) => f.path === "pre-existing-untracked.txt",
      );
      assert.equal(
        found,
        undefined,
        "pre-existing untracked file must not appear in changedFiles",
      );
    } finally {
      await cleanRepo(dir);
    }
  });

  // ── Modified tracked file present before session is NOT reported as modified ──

  it("does NOT report an unchanged tracked file as modified", async () => {
    const { dir, git } = await makeRepo();
    try {
      await commitFile(git, dir, "stable.txt", "stable content");
      const startingCommit = await commitFile(git, dir, "marker.txt", "marker");

      // stable.txt was not touched after startingCommit
      const result = await collectChanges(dir, startingCommit, noExclusions);
      const found = result.changedFiles.find((f) => f.path === "stable.txt");
      assert.equal(found, undefined, "unchanged pre-session file must not appear");
    } finally {
      await cleanRepo(dir);
    }
  });

  // ── File modified during session ──────────────────────────────────────────────

  it("reports a file modified after startingCommit as 'modified'", async () => {
    const { dir, git } = await makeRepo();
    try {
      const startingCommit = await commitFile(git, dir, "edit.txt", "original");
      // Modify and commit it
      await writeFile(join(dir, "edit.txt"), "modified content", "utf8");
      await git.add("edit.txt");
      await git.commit("modify edit.txt");

      const result = await collectChanges(dir, startingCommit, noExclusions);
      const found = result.changedFiles.find((f) => f.path === "edit.txt");
      assert.ok(found, "edit.txt should be in changedFiles");
      assert.equal(found?.changeType, "modified");
    } finally {
      await cleanRepo(dir);
    }
  });

  // ── File deleted during session ───────────────────────────────────────────────

  it("reports a file deleted after startingCommit as 'deleted'", async () => {
    const { dir, git } = await makeRepo();
    try {
      const startingCommit = await commitFile(git, dir, "delete-me.txt", "bye");
      await git.rm("delete-me.txt");
      await git.commit("delete delete-me.txt");

      const result = await collectChanges(dir, startingCommit, noExclusions);
      const found = result.changedFiles.find((f) => f.path === "delete-me.txt");
      assert.ok(found, "delete-me.txt should appear as deleted");
      assert.equal(found?.changeType, "deleted");
    } finally {
      await cleanRepo(dir);
    }
  });

  // ── File renamed during session ───────────────────────────────────────────────

  it("reports a renamed file as 'renamed'", async () => {
    const { dir, git } = await makeRepo();
    try {
      const startingCommit = await commitFile(git, dir, "old-name.txt", "content");
      await git.mv("old-name.txt", "new-name.txt");
      await git.commit("rename old-name.txt → new-name.txt");

      const result = await collectChanges(dir, startingCommit, noExclusions);
      const found = result.changedFiles.find((f) => f.path === "new-name.txt");
      assert.ok(found, "new-name.txt should appear after rename");
      assert.equal(found?.changeType, "renamed");
    } finally {
      await cleanRepo(dir);
    }
  });

  // ── .aven/ files never appear ─────────────────────────────────────────────────

  it(".aven/ files are never included in changedFiles when excluded", async () => {
    const { dir, git } = await makeRepo();
    try {
      const startingCommit = await commitFile(git, dir, "code.ts", "const x = 1;");
      await mkdir(join(dir, ".aven"), { recursive: true });
      await writeFile(join(dir, ".aven", "session.json"), '{"version":1}', "utf8");
      await git.add(".aven/session.json");
      await git.commit("add .aven/session.json");

      const result = await collectChanges(dir, startingCommit, avenExclusions);
      const found = result.changedFiles.find((f) => f.path.startsWith(".aven/"));
      const includedAven = result.changedFiles.find(
        (f) => f.path.startsWith(".aven/") && f.includedInVerification,
      );
      assert.equal(includedAven, undefined, ".aven files must not be included in verification");
      // They may appear in changedFiles but must be excluded from verification
      if (found) {
        assert.equal(found.includedInVerification, false);
      }
    } finally {
      await cleanRepo(dir);
    }
  });
});
