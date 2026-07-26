import assert from "node:assert/strict";
import test from "node:test";
import {
  assertWorkVerifierMatches,
  WorkVerifierConfigurationError,
} from "../work-stream-verifier-config.ts";

test("accepts the verifier configured on the contract", () => {
  assert.doesNotThrow(() => assertWorkVerifierMatches("GABCDEF", "gabcdef"));
});

test("reports a service configuration error when the verifier differs", () => {
  assert.throws(
    () => assertWorkVerifierMatches("GSERVER", "GCONTRACT"),
    (error: unknown) => {
      assert.ok(error instanceof WorkVerifierConfigurationError);
      assert.equal(error.httpStatus, 503);
      assert.match(error.message, /does not match/i);
      return true;
    },
  );
});

test("reports a service configuration error when no verifier is configured", () => {
  assert.throws(
    () => assertWorkVerifierMatches("GSERVER", undefined),
    (error: unknown) => {
      assert.ok(error instanceof WorkVerifierConfigurationError);
      assert.equal(error.httpStatus, 503);
      assert.match(error.message, /no verifier configured/i);
      return true;
    },
  );
});
