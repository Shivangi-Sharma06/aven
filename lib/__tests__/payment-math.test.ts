import assert from "node:assert/strict";
import test from "node:test";
import { calculateSettlementSecondsForRate } from "../work-session-math.ts";

test("completion settlement rounds seconds up so the contract cap reaches all escrow", () => {
  assert.equal(calculateSettlementSecondsForRate(10n, 3n), 4n);
  assert.ok(3n * calculateSettlementSecondsForRate(10n, 3n) >= 10n);
});

test("completion settlement rejects empty escrow and unusable rates", () => {
  assert.throws(
    () => calculateSettlementSecondsForRate(0n, 3n),
    /No unreserved escrow remains/,
  );
  assert.throws(
    () => calculateSettlementSecondsForRate(10n, 0n),
    /rate is too small/,
  );
});
