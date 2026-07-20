export const MAX_U64 = 18_446_744_073_709_551_615n;

export function calculateSettlementSecondsForRate(
  availableUnits: bigint,
  ratePerSecondUnits: bigint,
) {
  if (availableUnits <= 0n) {
    throw new Error("No unreserved escrow remains to complete this project.");
  }
  if (ratePerSecondUnits <= 0n) {
    throw new Error("The on-chain stream rate is too small to settle this project.");
  }
  const seconds =
    (availableUnits + ratePerSecondUnits - 1n) / ratePerSecondUnits;
  if (seconds > MAX_U64) {
    throw new Error("The calculated settlement duration exceeds the contract limit.");
  }
  return seconds;
}
