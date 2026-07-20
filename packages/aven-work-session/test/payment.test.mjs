import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAutomaticPayment,
  calculateCompletionPayment,
} from "../dist/report.js";

test("calculates payment from active seconds and unreserved escrow", () => {
  assert.equal(
    calculateAutomaticPayment("0.0000173", 60, "3.0000000"),
    "0.0010380",
  );
});

test("caps a work session at the unreserved escrow", () => {
  assert.equal(
    calculateAutomaticPayment("0.0000173", 1_000_000, "3.0000000"),
    "3.0000000",
  );
});

test("distinguishes zero tracked time from exhausted escrow", () => {
  assert.throws(
    () => calculateAutomaticPayment("0.0000173", 0, "3.0000000"),
    /No active work time was recorded/,
  );
  assert.throws(
    () => calculateAutomaticPayment("0.0000173", 60, "0.0000000"),
    /No unreserved escrow remains/,
  );
});

test("a final project session requests the exact remaining unreserved escrow", () => {
  assert.equal(calculateCompletionPayment("18.6250000"), "18.6250000");
  assert.throws(
    () => calculateCompletionPayment("0.0000000"),
    /No unreserved escrow remains to complete this project/,
  );
});
