import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PACKAGE_VERSION } from "../dist/version.js";

test("runtime, package, and lockfile versions agree", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url)));
  const packageLock = JSON.parse(
    await readFile(new URL("../package-lock.json", import.meta.url)),
  );
  assert.equal(PACKAGE_VERSION, packageJson.version);
  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages[""].version, packageJson.version);
});
