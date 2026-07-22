import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const cliPath = new URL("../dist/cli.js", import.meta.url);

test("help documents the final-project --ended workflow", async () => {
  const [{ stdout: rootHelp }, { stdout: stopHelp }] = await Promise.all([
    execFileAsync(process.execPath, [cliPath.pathname, "--help"]),
    execFileAsync(process.execPath, [cliPath.pathname, "stop", "--help"]),
  ]);

  assert.match(rootHelp, /aven stop --ended/);
  assert.match(rootHelp, /choose the delivery branches/);
  assert.match(stopHelp, /--ended/);
  assert.match(stopHelp, /final project session/);
});
