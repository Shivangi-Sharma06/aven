import "server-only";

import { createHash } from "node:crypto";
import { Keypair, TransactionBuilder, xdr } from "@stellar/stellar-sdk";
import { Client as StreamClient } from "../contracts/bindings/stream/src/index";
import {
  NETWORK_PASSPHRASE,
  SOROBAN_RPC_URL,
  STREAM_CONTRACT_ID,
} from "./contracts";
import type { WorkSessionReport } from "./work-session";
import {
  assertWorkVerifierMatches,
  isLegacyVerifierGetterMissing,
} from "./work-stream-verifier-config";

function unwrap<T>(value: unknown): T {
  return ((value as { unwrap?: () => T })?.unwrap?.() ?? value) as T;
}

function confirmedTransactionHash(sent: any): string {
  const value =
    sent?.sendTransactionResponse?.hash ??
    sent?.getTransactionResponse?.txHash ??
    sent?.hash;
  if (typeof value === "string" && /^[a-f\d]{64}$/i.test(value)) return value.toLowerCase();
  if (value instanceof Uint8Array && value.byteLength === 32) {
    return Buffer.from(value).toString("hex");
  }
  throw new Error("The verifier transaction was confirmed without a readable transaction hash.");
}

function reportDigest(report: WorkSessionReport) {
  return createHash("sha256").update(JSON.stringify(report)).digest();
}

async function verifierClient() {
  const secret = process.env.AVEN_VERIFIER_SECRET?.trim();
  if (!secret) throw new Error("AVEN_VERIFIER_SECRET is not configured on the server.");
  if (!STREAM_CONTRACT_ID) {
    throw new Error("NEXT_PUBLIC_STREAM_CONTRACT_ID is not configured.");
  }

  const keypair = Keypair.fromSecret(secret);
  const client = new StreamClient({
    contractId: STREAM_CONTRACT_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: SOROBAN_RPC_URL,
    publicKey: keypair.publicKey(),
    signTransaction: async (xdr: string) => {
      const transaction = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
      transaction.sign(keypair);
      return { signedTxXdr: transaction.toXDR(), signerAddress: keypair.publicKey() };
    },
  });
  try {
    const configured = await client.get_verifier();
    assertWorkVerifierMatches(keypair.publicKey(), configured.result);
  } catch (error) {
    if (!isLegacyVerifierGetterMissing(error)) throw error;
    // Legacy testnet contracts still enforce the configured verifier through
    // require_auth() in verify_work. A mismatched server key therefore fails
    // during simulation instead of being able to reserve any escrow.
  }
  return client;
}

export async function recordVerifiedWork(input: {
  streamId: string;
  sessionId: string;
  amountUnits: bigint;
  report: WorkSessionReport;
  onchainActiveSeconds?: bigint | number;
  workStartLedger?: number;
}) {
  const client = await verifierClient();
  const digest = reportDigest(input.report);

  const transaction = await client.verify_work({
    stream_id: BigInt(input.streamId),
    request_id: input.sessionId,
    amount: input.amountUnits,
    evidence_hash: digest,
    active_duration_seconds: BigInt(
      input.onchainActiveSeconds ?? input.report.session.activeSeconds ?? 0,
    ),
    work_start_ledger: input.workStartLedger ?? 0,
  });

  // Determine which addresses require auth entry signing. If the simulation
  // returns an address that is NOT the verifier keypair, it means set_verifier
  // hasn't been called yet (the verifier storage key is absent) or was set to
  // a different key. In either case, the verifier keypair cannot satisfy it.
  const nonInvokerSigners = transaction.needsNonInvokerSigningBy();
  for (const signer of nonInvokerSigners) {
    if (signer !== keypair.publicKey()) {
      throw new Error(
        `The stream contract expects ${signer} as the verifier, but the server ` +
        `has ${keypair.publicKey()}. Go to /set-verifier to register the correct verifier. ` +
        `See needsNonInvokerSigningBy for details.`,
      );
    }
    await transaction.signAuthEntries({ address: signer });
  }

  const sent = await transaction.signAndSend();
  const claimTx = await client.get_withdrawal({
    stream_id: BigInt(input.streamId),
    request_id: input.sessionId,
  });
  const claim = unwrap<any>(claimTx.result);

  return {
    transactionHash: confirmedTransactionHash(sent),
    reportDigest: digest.toString("hex"),
    reviewDeadlineLedger: Number(claim.deadline_ledger),
  };
}
