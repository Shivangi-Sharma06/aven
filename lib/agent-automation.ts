import { Buffer } from "buffer";
import type {
  Category,
  MandateConfig,
  MandatePolicy,
  SpendWindow,
  StreamParams,
  StreamProposal,
} from "@/contracts/bindings/agent_mandate/src/index";
import { getAgentMandateClient, toContractAmount, fromContractAmount } from "@/lib/contracts";

export type { MandateConfig, MandatePolicy, SpendWindow, StreamProposal };

export type MandateSnapshot = {
  address: string;
  config: MandateConfig;
  spendWindow: SpendWindow;
  balance: number;
  asset: string;
};

export type AgentStreamInput = {
  recipient: string;
  asset: string;
  totalAmount: number;
  ratePerSecond: number;
  durationLedgers: number;
  checkpointCount: number;
  withdrawableCapPercent: number;
  approvalTimeoutLedgers: number;
  title: string;
  category?: Category["tag"];
};

const CONTRACT_ERRORS: Record<number, string> = {
  1: "The mandate policy is invalid.",
  2: "The amount must be greater than zero.",
  3: "The stream settings are invalid.",
  4: "This mandate is paused.",
  5: "This mandate has been permanently revoked.",
  6: "This mandate has expired.",
  7: "That asset is not allowed by this mandate.",
  8: "That recipient is not allowed by this mandate.",
  9: "The payment exceeds the per-stream limit.",
  10: "The payment exceeds the rolling spend limit.",
  11: "This payment needs owner approval.",
  12: "This job request has already been handled.",
  13: "The proposal was not found.",
  14: "The proposal is no longer pending.",
  15: "The mandate does not have enough available balance.",
  16: "This signer is not authorized for that action.",
  17: "That stream is not controlled by this mandate.",
  18: "The requested values overflow the contract limits.",
  19: "Too many assets were supplied.",
};

function unwrap<T>(value: T | { unwrap?: () => T }): T {
  if (value && typeof value === "object" && "unwrap" in value && typeof value.unwrap === "function") {
    return value.unwrap();
  }
  return value as T;
}

function readableError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/(?:Error\(Contract,\s*#?|Error\(Contract,\s*)(\d+)/i)
    ?? message.match(/contract[^\d]*(\d+)/i);
  const code = match ? Number(match[1]) : 0;
  return new Error(CONTRACT_ERRORS[code] ?? message);
}

async function send<T>(transaction: { signAndSend: () => Promise<T> }): Promise<T> {
  try {
    // Generated clients simulate before returning an assembled transaction.
    return await transaction.signAndSend();
  } catch (error) {
    throw readableError(error);
  }
}

export async function requestIdFor(jobId: string): Promise<Buffer> {
  const normalized = jobId.trim();
  if (!normalized) throw new Error("A stable job ID is required.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Buffer.from(digest);
}

export async function loadMandateSnapshot(
  mandateAddress: string,
  callerAddress: string,
  asset: string,
): Promise<MandateSnapshot> {
  const client = getAgentMandateClient(callerAddress, mandateAddress);
  try {
    const [configTx, spendTx, balanceTx] = await Promise.all([
      client.get_config(),
      client.get_spend_window(),
      client.get_balance({ asset }),
    ]);
    return {
      address: mandateAddress,
      config: configTx.result,
      spendWindow: spendTx.result,
      balance: fromContractAmount(balanceTx.result),
      asset,
    };
  } catch (error) {
    throw readableError(error);
  }
}

export async function depositMandate(
  mandateAddress: string,
  owner: string,
  asset: string,
  amount: number,
) {
  const tx = await getAgentMandateClient(owner, mandateAddress).deposit({
    owner,
    asset,
    amount: toContractAmount(amount),
  });
  return send(tx);
}

export async function withdrawMandateFunds(
  mandateAddress: string,
  owner: string,
  asset: string,
  amount: number,
  destination = owner,
) {
  const tx = await getAgentMandateClient(owner, mandateAddress).withdraw_unused({
    owner,
    asset,
    amount: toContractAmount(amount),
    destination,
  });
  return send(tx);
}

export async function updateMandatePolicy(
  mandateAddress: string,
  owner: string,
  policy: MandatePolicy,
) {
  const tx = await getAgentMandateClient(owner, mandateAddress).update_policy({ owner, policy });
  return send(tx);
}

export async function setMandateRecipient(
  mandateAddress: string,
  owner: string,
  recipient: string,
  allowed: boolean,
) {
  const tx = await getAgentMandateClient(owner, mandateAddress).set_recipient({
    owner,
    recipient,
    allowed,
  });
  return send(tx);
}

export async function changeMandateStatus(
  mandateAddress: string,
  owner: string,
  action: "pause" | "resume" | "revoke",
) {
  const client = getAgentMandateClient(owner, mandateAddress);
  const tx = await client[action]({ owner });
  return send(tx);
}

function streamParams(input: AgentStreamInput): StreamParams {
  return {
    recipient: input.recipient,
    asset: input.asset,
    total_deposited: toContractAmount(input.totalAmount),
    rate_per_second: toContractAmount(input.ratePerSecond),
    duration_ledgers: input.durationLedgers,
    checkpoint_count: input.checkpointCount,
    withdrawable_cap_percent: input.withdrawableCapPercent,
    approval_timeout_ledgers: input.approvalTimeoutLedgers,
    category: { tag: input.category ?? "AgentTask", values: undefined as void },
    title: input.title,
  };
}

export async function executeAgentStream(
  mandateAddress: string,
  agent: string,
  jobId: string,
  input: AgentStreamInput,
) {
  const tx = await getAgentMandateClient(agent, mandateAddress).execute_stream({
    agent,
    request_id: await requestIdFor(jobId),
    params: streamParams(input),
  });
  return send(tx);
}

export async function proposeAgentStream(
  mandateAddress: string,
  agent: string,
  jobId: string,
  input: AgentStreamInput,
) {
  const tx = await getAgentMandateClient(agent, mandateAddress).propose_stream({
    agent,
    request_id: await requestIdFor(jobId),
    params: streamParams(input),
  });
  return send(tx);
}

export async function loadProposal(mandateAddress: string, caller: string, proposalId: bigint) {
  const tx = await getAgentMandateClient(caller, mandateAddress).get_proposal({
    proposal_id: proposalId,
  });
  return unwrap<StreamProposal>(tx.result);
}

export async function resolveProposal(
  mandateAddress: string,
  owner: string,
  proposalId: bigint,
  approved: boolean,
) {
  const client = getAgentMandateClient(owner, mandateAddress);
  const tx = approved
    ? await client.approve_and_execute({ owner, proposal_id: proposalId })
    : await client.reject_proposal({ owner, proposal_id: proposalId });
  return send(tx);
}

export async function approveMandateCheckpoint(
  mandateAddress: string,
  caller: string,
  streamId: bigint,
  index: number,
) {
  const tx = await getAgentMandateClient(caller, mandateAddress).approve_checkpoint({
    caller,
    stream_id: streamId,
    index,
  });
  return send(tx);
}
