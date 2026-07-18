import assert from "node:assert/strict";
import test from "node:test";
import { resolveStopTimestamp } from "../dist/stop.js";

test("a legacy stopped session retries from its file modification time", () => {
  const originalStop = new Date("2026-07-18T12:00:00.000Z");
  const retriedAt = new Date("2026-07-18T13:00:00.000Z");
  assert.equal(
    resolveStopTimestamp({ status: "stopped" }, originalStop, retriedAt).toISOString(),
    originalStop.toISOString(),
  );
});

test("a stored stop timestamp remains stable across retries", () => {
  const originalStop = "2026-07-18T12:00:00.000Z";
  assert.equal(
    resolveStopTimestamp(
      { status: "stopped", stoppedAt: originalStop },
      new Date("2026-07-18T12:30:00.000Z"),
      new Date("2026-07-18T13:00:00.000Z"),
    ).toISOString(),
    originalStop,
  );
});

test("an active session stops at the current time", () => {
  const now = new Date("2026-07-18T13:00:00.000Z");
  assert.equal(
    resolveStopTimestamp(
      { status: "active" },
      new Date("2026-07-18T12:00:00.000Z"),
      now,
    ).toISOString(),
    now.toISOString(),
  );
});
