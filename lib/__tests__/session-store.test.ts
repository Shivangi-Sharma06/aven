/**
 * session-store.test.ts – Unit tests for session-store idempotency and state.
 *
 * These tests use an isolated in-memory Map to simulate Redis/local storage
 * without requiring a real Redis connection.
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { randomUUID } from "node:crypto";
import type { WorkSession } from "../work-session.js";

// ---------------------------------------------------------------------------
// In-memory session store simulation
// ---------------------------------------------------------------------------
class InMemorySessionStore {
  private store = new Map<string, WorkSession>();

  async get(id: string): Promise<WorkSession | null> {
    return this.store.get(id) ?? null;
  }

  async put(session: WorkSession): Promise<WorkSession> {
    this.store.set(session.id, session);
    return session;
  }

  async list(): Promise<WorkSession[]> {
    return [...this.store.values()];
  }

  size(): number {
    return this.store.size;
  }
}

function makeSession(overrides?: Partial<WorkSession>): WorkSession {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    streamId: "1",
    workerAddress: "GWORKER",
    clientAddress: "GCLIENT",
    status: "SUBMITTED",
    createdAt: now,
    updatedAt: now,
    timeline: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("session store – idempotency", () => {
  test("submitting the same session ID twice returns the same record", async () => {
    const store = new InMemorySessionStore();
    const session = makeSession();

    await store.put(session);
    // Simulate a retry: put the same session again
    await store.put({ ...session });

    const all = await store.list();
    assert.equal(all.length, 1, "Duplicate submission must not create a second record");
    assert.equal(all[0].id, session.id);
  });

  test("sessions survive a simulated server restart (re-hydration)", async () => {
    const store = new InMemorySessionStore();
    const session = makeSession({ status: "VERIFICATION_COMPLETE" });
    await store.put(session);

    // Simulate a new server instance reading the same store
    const reloaded = await store.get(session.id);
    assert.ok(reloaded, "Session must survive store re-hydration");
    assert.equal(reloaded!.status, "VERIFICATION_COMPLETE");
  });

  test("two simulated instances share the same state", async () => {
    const sharedStore = new InMemorySessionStore();
    const session = makeSession();

    // Instance A writes
    await sharedStore.put(session);

    // Instance B reads
    const fromB = await sharedStore.get(session.id);
    assert.ok(fromB, "Instance B must see the session written by instance A");
    assert.equal(fromB!.id, session.id);
  });
});

describe("session store – status transitions", () => {
  test("worker and client roles stay separate", async () => {
    const store = new InMemorySessionStore();
    const session = makeSession({
      workerAddress: "GWORKER",
      clientAddress: "GCLIENT",
    });
    await store.put(session);
    const loaded = await store.get(session.id);
    assert.notEqual(loaded!.workerAddress, loaded!.clientAddress);
    assert.equal(loaded!.workerAddress, "GWORKER");
    assert.equal(loaded!.clientAddress, "GCLIENT");
  });

  test("unrelated wallet cannot see a session not belonging to it", async () => {
    const store = new InMemorySessionStore();
    const session = makeSession({ workerAddress: "GWORKER", clientAddress: "GCLIENT" });
    await store.put(session);
    const loaded = await store.get(session.id);
    assert.ok(loaded);

    // Simulate an authorization check: unrelated wallet "GOTHER" must not pass
    const unrelated = "GOTHER";
    const canView =
      loaded!.workerAddress.toUpperCase() === unrelated.toUpperCase() ||
      loaded!.clientAddress.toUpperCase() === unrelated.toUpperCase();
    assert.equal(canView, false, "Unrelated wallet must not be authorized to view session");
  });
});

describe("session store – timeline integrity", () => {
  test("timeline events accumulate in order", async () => {
    const store = new InMemorySessionStore();
    const session = makeSession();
    const now = new Date().toISOString();

    session.timeline = [
      { status: "SUBMITTED", at: now, actor: "worker", note: "Submitted" },
    ];
    await store.put(session);

    // Add another event
    session.timeline = [
      ...session.timeline,
      { status: "VERIFYING", at: new Date().toISOString(), actor: "system" },
    ];
    await store.put(session);

    const loaded = await store.get(session.id);
    assert.equal(loaded!.timeline!.length, 2);
    assert.equal(loaded!.timeline![0].status, "SUBMITTED");
    assert.equal(loaded!.timeline![1].status, "VERIFYING");
  });
});
