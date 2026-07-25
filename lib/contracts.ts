/**
 * Aven — Contract client factory
 *
 * Network configuration is driven by environment variables so the same
 * codebase works for testnet (default) and mainnet.
 *
 * For mainnet deployment, set these in your Vercel/deployment environment:
 *   NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-rpc.mainnet.stellar.org
 *   NEXT_PUBLIC_HORIZON_URL=https://horizon.stellar.org
 *   NEXT_PUBLIC_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
 *   NEXT_PUBLIC_USDC_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
 *   NEXT_PUBLIC_USDC_ASSET_ID=CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75
 *   NEXT_PUBLIC_XLM_ASSET_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
 *   NEXT_PUBLIC_STELLAR_EXPLORER=https://stellar.expert/explorer/public
 */

import { Client as StreamClient } from "../contracts/bindings/stream/src/index";
import { Client as AttestationClient } from "../contracts/bindings/attestation/src/index";
import { Client as ReputationClient } from "../contracts/bindings/reputation/src/index";
import { signTransaction } from "@stellar/freighter-api";

// ─── Network Configuration (env-driven, testnet defaults) ─────────────────────

export const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ??
  "Test SDF Network ; September 2015";

/** Stellar expert explorer base URL — set for mainnet in env vars */
export const STELLAR_EXPLORER =
  process.env.NEXT_PUBLIC_STELLAR_EXPLORER ??
  "https://stellar.expert/explorer/testnet";

/** Human-readable network label for UI display */
export const NETWORK_LABEL =
  process.env.NEXT_PUBLIC_NETWORK_LABEL ?? "Stellar Testnet";

export const STREAM_CONTRACT_ID = process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID ?? "";
export const ATTESTATION_CONTRACT_ID = process.env.NEXT_PUBLIC_ATTESTATION_CONTRACT_ID ?? "";
export const REPUTATION_CONTRACT_ID = process.env.NEXT_PUBLIC_REPUTATION_CONTRACT_ID ?? "";

/** USDC on Stellar testnet (default) — override for mainnet */
export const USDC_ASSET_CODE = "USDC";
export const USDC_ISSUER =
  process.env.NEXT_PUBLIC_USDC_ISSUER ??
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
export const USDC_ASSET_ID =
  process.env.NEXT_PUBLIC_USDC_ASSET_ID ??
  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
/** Native XLM SAC */
export const XLM_ASSET_ID =
  process.env.NEXT_PUBLIC_XLM_ASSET_ID ??
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

/** 7 decimal fixed-point, same as Stellar stroops */
export function toContractAmount(human: number): bigint {
  return BigInt(Math.round(human * 10_000_000));
}

export function fromContractAmount(raw: bigint | number | string): number {
  return Number(BigInt(String(raw))) / 10_000_000;
}

/** Freighter signTransaction wrapped to match SDK's SignTransaction type */
export const freighterSignTx = async (
  xdr: string,
  opts?: { networkPassphrase?: string; address?: string }
): Promise<{ signedTxXdr: string; signerAddress?: string }> => {
  const res = await signTransaction(xdr, {
    networkPassphrase: opts?.networkPassphrase ?? NETWORK_PASSPHRASE,
  });
  // freighter-api v4.x returns either string or { signedTxXdr }
  if (typeof res === "string") return { signedTxXdr: res };
  return res as { signedTxXdr: string; signerAddress?: string };
};

function baseOptions(publicKey: string) {
  return {
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: SOROBAN_RPC_URL,
    publicKey,
    signTransaction: freighterSignTx,
  };
}

export function getStreamClient(publicKey: string) {
  if (!STREAM_CONTRACT_ID) {
    throw new Error("NEXT_PUBLIC_STREAM_CONTRACT_ID is not configured.");
  }
  return new StreamClient({
    ...baseOptions(publicKey),
    contractId: STREAM_CONTRACT_ID,
  });
}

export function getAttestationClient(publicKey: string) {
  if (!ATTESTATION_CONTRACT_ID) {
    throw new Error("NEXT_PUBLIC_ATTESTATION_CONTRACT_ID is not configured.");
  }
  return new AttestationClient({
    ...baseOptions(publicKey),
    contractId: ATTESTATION_CONTRACT_ID,
  });
}

export function getReputationClient(publicKey: string) {
  if (!REPUTATION_CONTRACT_ID) {
    throw new Error("NEXT_PUBLIC_REPUTATION_CONTRACT_ID is not configured.");
  }
  return new ReputationClient({
    ...baseOptions(publicKey),
    contractId: REPUTATION_CONTRACT_ID,
  });
}