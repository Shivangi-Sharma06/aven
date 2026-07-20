import assert from "node:assert/strict";
import test from "node:test";
import { isAvenConfig } from "../dist/config.js";
import { isLocalSession } from "../dist/session.js";

const validConfig = {
  version: 1,
  dashboardUrl: "https://aven.example",
  projectId: "aven-1",
  contractId: "CA123",
  streamId: "1",
  workerAddress: "GWORKER",
  asset: "USDC",
  token: "token",
  ratePerSecond: "0.0000173",
};

const validSession = {
  version: 1,
  sessionId: "session-a",
  projectId: "aven-1",
  streamId: "1",
  workerAddress: "GWORKER",
  status: "active",
  startedAt: "2026-07-20T12:00:00.000Z",
  startingBranch: "dev",
  dirtyAtStart: false,
  lastActivityAt: "2026-07-20T12:00:00.000Z",
  activeSeconds: 0,
  idleSeconds: 0,
  activityEvents: 0,
};

test("config validation accepts a complete config", () => {
  assert.equal(isAvenConfig(validConfig), true);
});

test("config validation rejects invalid URLs, streams, assets, and rates", () => {
  assert.equal(isAvenConfig({ ...validConfig, dashboardUrl: "not-a-url" }), false);
  assert.equal(isAvenConfig({ ...validConfig, streamId: "stream-1" }), false);
  assert.equal(isAvenConfig({ ...validConfig, asset: "BTC" }), false);
  assert.equal(isAvenConfig({ ...validConfig, ratePerSecond: "NaN" }), false);
});

test("session validation accepts a complete active session", () => {
  assert.equal(isLocalSession(validSession), true);
});

test("session validation rejects unknown status and invalid counters", () => {
  assert.equal(isLocalSession({ ...validSession, status: "garbage" }), false);
  assert.equal(isLocalSession({ ...validSession, activeSeconds: Number.NaN }), false);
  assert.equal(isLocalSession({ ...validSession, activityEvents: -1 }), false);
  assert.equal(isLocalSession({ ...validSession, watcherPid: 0 }), false);
});
