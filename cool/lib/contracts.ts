/**
 * Aven — Contract client factory
 */

import { Client as StreamClient, networks as streamNetworks } from "../bindings/stream/src/index";
import { Client as AttestationClient, networks as attestNetworks } from "../bindings/attestation/src/index";
import { Client as ReputationClient, networks as reputationNetworks } from "../bindings/reputation/src/index";
import { signTransaction } from "@stellar/freighter-api";

export const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

/** USDC on Stellar testnet */
export const USDC_ASSET_ID = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
/** Native XLM SAC on testnet */
export const XLM_ASSET_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

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
  return new StreamClient({
    ...baseOptions(publicKey),
    contractId: streamNetworks.testnet.contractId,
  });
}

export function getAttestationClient(publicKey: string) {
  return new AttestationClient({
    ...baseOptions(publicKey),
    contractId: attestNetworks.testnet.contractId,
  });
}

export function getReputationClient(publicKey: string) {
  return new ReputationClient({
    ...baseOptions(publicKey),
    contractId: reputationNetworks.testnet.contractId,
  });
}
