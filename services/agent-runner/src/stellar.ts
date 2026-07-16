import { createHash } from "node:crypto";
import { Buffer } from "buffer";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { Client } from "../../../contracts/bindings/agent_mandate/dist/index.js";
import type { StreamParams } from "../../../contracts/bindings/agent_mandate/src/index.ts";
import { needsOwnerApproval, validateLocally } from "./policy.ts";
import type { StreamJob } from "./types.ts";

const MAX_ATTEMPTS = 3;
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const SOROBAN_RPC_URL = process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";

function rawAmount(value: string) {
  if (!/^\d+$/.test(value) || value === "0") {
    throw new Error("Amounts must be positive integers in 7-decimal contract units.");
  }
  return BigInt(value);
}

function resultValue(value: unknown) {
  if (value && typeof value === "object" && "unwrap" in value) {
    return (value as { unwrap: () => unknown }).unwrap();
  }
  return value;
}

export function requestId(jobId: string) {
  return createHash("sha256").update(jobId.trim()).digest();
}

export function createMandateClient(contractId: string, secret: string) {
  const signer = Keypair.fromSecret(secret);
  return {
    address: signer.publicKey(),
    client: new Client({
      contractId,
      publicKey: signer.publicKey(),
      rpcUrl: SOROBAN_RPC_URL,
      networkPassphrase: NETWORK_PASSPHRASE,
      signTransaction: async (xdr: string) => {
        const transaction = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
        transaction.sign(signer);
        return { signedTxXdr: transaction.toXDR(), signerAddress: signer.publicKey() };
      },
    }),
  };
}

export function jobParams(job: StreamJob): StreamParams {
  return {
    recipient: job.recipient,
    asset: job.asset,
    total_deposited: rawAmount(job.totalAmount),
    rate_per_second: rawAmount(job.ratePerSecond),
    duration_ledgers: job.durationLedgers,
    checkpoint_count: job.checkpointCount,
    withdrawable_cap_percent: job.withdrawableCapPercent,
    approval_timeout_ledgers: job.approvalTimeoutLedgers,
    category: { tag: "AgentTask", values: undefined as void },
    title: job.title,
  };
}

export async function submitJob(
  contractId: string,
  agentSecret: string,
  job: StreamJob,
  forceOwnerApproval = false,
) {
  const { client, address } = createMandateClient(contractId, agentSecret);
  const configTx = await client.get_config();
  const ledger = await fetch(SOROBAN_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getLatestLedger" }),
  }).then(async (response) => {
    if (!response.ok) throw new Error(`RPC returned HTTP ${response.status}.`);
    return response.json() as Promise<{ result: { sequence: number } }>;
  });
  const params = jobParams(job);
  validateLocally(configTx.result, params, ledger.result.sequence);
  if (configTx.result.agent !== address) throw new Error("Runner signer is not this mandate's agent.");

  const id = requestId(job.jobId);
  const alreadyUsed = await client.is_request_used({ request_id: Buffer.from(id) });
  if (alreadyUsed.result) return { state: "already_processed" as const };

  const requiresOwner =
    forceOwnerApproval || needsOwnerApproval(configTx.result, params.total_deposited);
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const assembled = requiresOwner
        ? await client.propose_stream({ agent: address, request_id: Buffer.from(id), params })
        : await client.execute_stream({ agent: address, request_id: Buffer.from(id), params });
      const sent = await assembled.signAndSend();
      const result = String(resultValue((sent as { result?: unknown }).result) ?? "");
      return requiresOwner
        ? { state: "pending_owner" as const, proposalId: result, transactionHash: (sent as { hash?: string }).hash }
        : { state: "executed" as const, streamId: result, transactionHash: (sent as { hash?: string }).hash };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
    }
  }
  throw lastError;
}
