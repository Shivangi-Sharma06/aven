import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import { ensureAvenRemote } from "../dist/start.js";

const github = {
  repositoryId: 123,
  fullName: "Aven-Stellar/aven-1-project",
  htmlUrl: "https://github.com/Aven-Stellar/aven-1-project",
  cloneUrl: "https://github.com/Aven-Stellar/aven-1-project.git",
  sshUrl: "git@github.com:Aven-Stellar/aven-1-project.git",
};

async function withRepository(run) {
  const directory = await mkdtemp(join(tmpdir(), "aven-remote-test-"));
  try {
    const git = simpleGit(directory);
    await git.init();
    await run(directory, git);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("adds the managed repository as aven without touching origin", async () => {
  await withRepository(async (directory, git) => {
    await git.addRemote("origin", "git@example.test:user/project.git");
    await ensureAvenRemote(directory, github);
    const remotes = await git.getRemotes(true);
    assert.equal(remotes.find((remote) => remote.name === "aven")?.refs.fetch, github.sshUrl);
    assert.equal(
      remotes.find((remote) => remote.name === "origin")?.refs.fetch,
      "git@example.test:user/project.git",
    );
  });
});

test("accepts an existing aven remote with the HTTPS clone URL", async () => {
  await withRepository(async (directory, git) => {
    await git.addRemote("aven", github.cloneUrl);
    await ensureAvenRemote(directory, github);
    assert.equal((await git.getRemotes(true))[0].refs.fetch, github.cloneUrl);
  });
});

test("rejects an existing aven remote that points elsewhere", async () => {
  await withRepository(async (directory, git) => {
    await git.addRemote("aven", "git@example.test:someone/else.git");
    await assert.rejects(
      ensureAvenRemote(directory, github),
      /never overwrites remotes/i,
    );
  });
});
