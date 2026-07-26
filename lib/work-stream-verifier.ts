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

function verifierClient() {
  const secret = process.env.AVEN_VERIFIER_SECRET?.trim();
  if (!secret) throw new Error("AVEN_VERIFIER_SECRET is not configured on the server.");
  if (!STREAM_CONTRACT_ID) {
    throw new Error("NEXT_PUBLIC_STREAM_CONTRACT_ID is not configured.");
  }

  const keypair = Keypair.fromSecret(secret);
  return {
    keypair,
    client: new StreamClient({
      contractId: STREAM_CONTRACT_ID,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: SOROBAN_RPC_URL,
      publicKey: keypair.publicKey(),
      signTransaction: async (xdr: string) => {
        const transaction = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
        transaction.sign(keypair);
        return { signedTxXdr: transaction.toXDR(), signerAddress: keypair.publicKey() };
      },
      signAuthEntry: async (entryXdr: string) => {
        const entryBytes = Buffer.from(entryXdr, "base64");
        const hash = createHash("sha256").update(entryBytes).digest();
        const signature = keypair.sign(hash);
        // The SDK decodes the returned signedAuthEntry as a DecoratedSignature
        // XDR object. It must contain the 4-byte hint (last 4 bytes of the raw
        // public key) and the Ed25519 signature bytes.
        const rawPublicKey = keypair.rawPublicKey();
        const hint = rawPublicKey.slice(-4);
        const decoratedSignature = new xdr.DecoratedSignature({
          hint: hint,
          signature: signature,
        });
        return {
          signedAuthEntry: decoratedSignature.toXDR("base64"),
          signerAddress: keypair.publicKey(),
        };
      },
    }),
  };
}

export async function recordVerifiedWork(input: {
  streamId: string;
  sessionId: string;
  amountUnits: bigint;
  report: WorkSessionReport;
  onchainActiveSeconds?: bigint | number;
  workStartLedger?: number;
}) {
  const { client, keypair } = verifierClient();
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

  // The verifier keypair is set as the client's publicKey (source account /
  // invoker). The contract's verifier.require_auth() is satisfied by the
  // transaction envelope signature — no separate auth entries needed.
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
