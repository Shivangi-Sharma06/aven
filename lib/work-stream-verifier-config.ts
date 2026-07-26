export class WorkVerifierConfigurationError extends Error {
  readonly httpStatus = 503;

  constructor(message: string) {
    super(message);
    this.name = "WorkVerifierConfigurationError";
  }
}

export function assertWorkVerifierMatches(
  serverVerifier: string,
  contractVerifier: unknown,
) {
  if (typeof contractVerifier !== "string" || contractVerifier.trim() === "") {
    throw new WorkVerifierConfigurationError(
      "Withdrawal service is unavailable because the stream contract has no verifier configured.",
    );
  }

  if (contractVerifier.trim().toUpperCase() !== serverVerifier.trim().toUpperCase()) {
    throw new WorkVerifierConfigurationError(
      "Withdrawal service is unavailable because the server verifier does not match the stream contract.",
    );
  }
}
