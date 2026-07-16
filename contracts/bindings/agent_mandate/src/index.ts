import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export const Errors = {
  1: {message:"InvalidPolicy"},
  2: {message:"InvalidAmount"},
  3: {message:"InvalidStream"},
  4: {message:"MandatePaused"},
  5: {message:"MandateRevoked"},
  6: {message:"MandateExpired"},
  7: {message:"AssetNotAllowed"},
  8: {message:"RecipientNotAllowed"},
  9: {message:"PerStreamLimitExceeded"},
  10: {message:"WindowLimitExceeded"},
  11: {message:"OwnerApprovalRequired"},
  12: {message:"DuplicateRequest"},
  13: {message:"ProposalNotFound"},
  14: {message:"ProposalNotPending"},
  15: {message:"InsufficientMandateBalance"},
  16: {message:"NotAuthorized"},
  17: {message:"StreamNotManaged"},
  18: {message:"Overflow"},
  19: {message:"TooManyAssets"}
}



export interface SpendWindow {
  spent: i128;
  window_start: u32;
}


export interface StreamParams {
  approval_timeout_ledgers: u32;
  asset: string;
  category: Category;
  checkpoint_count: u32;
  duration_ledgers: u32;
  rate_per_second: i128;
  recipient: string;
  title: string;
  total_deposited: i128;
  withdrawable_cap_percent: u32;
}



export interface MandateConfig {
  agent: string;
  owner: string;
  paused: boolean;
  policy: MandatePolicy;
  revoked: boolean;
  stream_contract: string;
}


export interface MandatePolicy {
  agent_can_approve_checkpoints: boolean;
  enforce_recipient_allowlist: boolean;
  expires_at_ledger: u32;
  human_approval_threshold: i128;
  max_checkpoint_count: u32;
  max_duration_ledgers: u32;
  per_stream_limit: i128;
  window_ledgers: u32;
  window_limit: i128;
}




export type ProposalStatus = {tag: "Pending", values: void} | {tag: "Executed", values: void} | {tag: "Rejected", values: void};


export interface StreamProposal {
  id: u64;
  params: StreamParams;
  request_id: Buffer;
  status: ProposalStatus;
  stream_id: u64;
}






export type Category = {tag: "Freelance", values: void} | {tag: "Salary", values: void} | {tag: "Bounty", values: void} | {tag: "Grant", values: void} | {tag: "AgentTask", values: void} | {tag: "Subscription", values: void};


export interface StreamRecord {
  approval_timeout_ledgers: u32;
  asset: string;
  category: Category;
  checkpoint_count: u32;
  checkpoint_span_ledgers: u32;
  duration_ledgers: u32;
  id: u64;
  paused_at_ledger: u32;
  paused_duration_ledgers: u32;
  rate_per_ledger: i128;
  recipient: string;
  sender: string;
  start_ledger: u32;
  status: StreamStatus;
  title: string;
  total_deposited: i128;
  total_withdrawn: i128;
  withdrawable_cap_percent: u32;
}

export type StreamStatus = {tag: "Active", values: void} | {tag: "Paused", values: void} | {tag: "Completed", values: void} | {tag: "Cancelled", values: void};


export interface CheckpointRecord {
  approved: boolean;
  attestation_id: u64;
  auto_approved: boolean;
  due_ledger: u32;
  evidence_hash: Buffer;
  index: u32;
  stream_id: u64;
  submitted: boolean;
}


export interface AttestationRecord {
  amount_paid: i128;
  asset: string;
  category: Category;
  checkpoint_index: u32;
  client_confirmed: boolean;
  id: u64;
  minted_at_ledger: u32;
  period_end_ledger: u32;
  period_start_ledger: u32;
  recipient: string;
  sender: string;
  stream_id: u64;
  title: string;
}

export interface Client {
  /**
   * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  pause: ({owner}: {owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a resume transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  resume: ({owner}: {owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a revoke transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  revoke: ({owner}: {owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  deposit: ({owner, asset, amount}: {owner: string, asset: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_agent transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_agent: ({owner, agent}: {owner: string, agent: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_asset transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_asset: ({owner, asset, allowed}: {owner: string, asset: string, allowed: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<MandateConfig>>

  /**
   * Construct and simulate a get_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_balance: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_proposal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_proposal: ({proposal_id}: {proposal_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<StreamProposal>>>

  /**
   * Construct and simulate a set_recipient transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_recipient: ({owner, recipient, allowed}: {owner: string, recipient: string, allowed: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a update_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_policy: ({owner, policy}: {owner: string, policy: MandatePolicy}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a execute_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  execute_stream: ({agent, request_id, params}: {agent: string, request_id: Buffer, params: StreamParams}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a propose_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  propose_stream: ({agent, request_id, params}: {agent: string, request_id: Buffer, params: StreamParams}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a is_request_used transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_request_used: ({request_id}: {request_id: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a reject_proposal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  reject_proposal: ({owner, proposal_id}: {owner: string, proposal_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a withdraw_unused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  withdraw_unused: ({owner, asset, amount, destination}: {owner: string, asset: string, amount: i128, destination: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_spend_window transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_spend_window: (options?: MethodOptions) => Promise<AssembledTransaction<SpendWindow>>

  /**
   * Construct and simulate a is_asset_allowed transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_asset_allowed: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a approve_checkpoint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  approve_checkpoint: ({caller, stream_id, index}: {caller: string, stream_id: u64, index: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a approve_and_execute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  approve_and_execute: ({owner, proposal_id}: {owner: string, proposal_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a is_recipient_allowed transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_recipient_allowed: ({recipient}: {recipient: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {owner, agent, stream_contract, allowed_assets, policy}: {owner: string, agent: string, stream_contract: string, allowed_assets: Array<string>, policy: MandatePolicy},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({owner, agent, stream_contract, allowed_assets, policy}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAEwAAAAAAAAANSW52YWxpZFBvbGljeQAAAAAAAAEAAAAAAAAADUludmFsaWRBbW91bnQAAAAAAAACAAAAAAAAAA1JbnZhbGlkU3RyZWFtAAAAAAAAAwAAAAAAAAANTWFuZGF0ZVBhdXNlZAAAAAAAAAQAAAAAAAAADk1hbmRhdGVSZXZva2VkAAAAAAAFAAAAAAAAAA5NYW5kYXRlRXhwaXJlZAAAAAAABgAAAAAAAAAPQXNzZXROb3RBbGxvd2VkAAAAAAcAAAAAAAAAE1JlY2lwaWVudE5vdEFsbG93ZWQAAAAACAAAAAAAAAAWUGVyU3RyZWFtTGltaXRFeGNlZWRlZAAAAAAACQAAAAAAAAATV2luZG93TGltaXRFeGNlZWRlZAAAAAAKAAAAAAAAABVPd25lckFwcHJvdmFsUmVxdWlyZWQAAAAAAAALAAAAAAAAABBEdXBsaWNhdGVSZXF1ZXN0AAAADAAAAAAAAAAQUHJvcG9zYWxOb3RGb3VuZAAAAA0AAAAAAAAAElByb3Bvc2FsTm90UGVuZGluZwAAAAAADgAAAAAAAAAaSW5zdWZmaWNpZW50TWFuZGF0ZUJhbGFuY2UAAAAAAA8AAAAAAAAADU5vdEF1dGhvcml6ZWQAAAAAAAAQAAAAAAAAABBTdHJlYW1Ob3RNYW5hZ2VkAAAAEQAAAAAAAAAIT3ZlcmZsb3cAAAASAAAAAAAAAA1Ub29NYW55QXNzZXRzAAAAAAAAEw==",
        "AAAABQAAAAAAAAAAAAAACEFzc2V0U2V0AAAAAgAAAAdtYW5kYXRlAAAAAAlhc3NldF9zZXQAAAAAAAACAAAAAAAAAAVhc3NldAAAAAAAABMAAAABAAAAAAAAAAdhbGxvd2VkAAAAAAEAAAAAAAAAAg==",
        "AAAAAQAAAAAAAAAAAAAAC1NwZW5kV2luZG93AAAAAAIAAAAAAAAABXNwZW50AAAAAAAACwAAAAAAAAAMd2luZG93X3N0YXJ0AAAABA==",
        "AAAAAQAAAAAAAAAAAAAADFN0cmVhbVBhcmFtcwAAAAoAAAAAAAAAGGFwcHJvdmFsX3RpbWVvdXRfbGVkZ2VycwAAAAQAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAAAAAAIY2F0ZWdvcnkAAAfQAAAACENhdGVnb3J5AAAAAAAAABBjaGVja3BvaW50X2NvdW50AAAABAAAAAAAAAAQZHVyYXRpb25fbGVkZ2VycwAAAAQAAAAAAAAAD3JhdGVfcGVyX3NlY29uZAAAAAALAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAAV0aXRsZQAAAAAAABAAAAAAAAAAD3RvdGFsX2RlcG9zaXRlZAAAAAALAAAAAAAAABh3aXRoZHJhd2FibGVfY2FwX3BlcmNlbnQAAAAE",
        "AAAABQAAAAAAAAAAAAAADFJlY2lwaWVudFNldAAAAAIAAAAHbWFuZGF0ZQAAAAANcmVjaXBpZW50X3NldAAAAAAAAAIAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAABAAAAAAAAAAdhbGxvd2VkAAAAAAEAAAAAAAAAAg==",
        "AAAAAQAAAAAAAAAAAAAADU1hbmRhdGVDb25maWcAAAAAAAAGAAAAAAAAAAVhZ2VudAAAAAAAABMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAGcGF1c2VkAAAAAAABAAAAAAAAAAZwb2xpY3kAAAAAB9AAAAANTWFuZGF0ZVBvbGljeQAAAAAAAAAAAAAHcmV2b2tlZAAAAAABAAAAAAAAAA9zdHJlYW1fY29udHJhY3QAAAAAEw==",
        "AAAAAQAAAAAAAAAAAAAADU1hbmRhdGVQb2xpY3kAAAAAAAAJAAAAAAAAAB1hZ2VudF9jYW5fYXBwcm92ZV9jaGVja3BvaW50cwAAAAAAAAEAAAAAAAAAG2VuZm9yY2VfcmVjaXBpZW50X2FsbG93bGlzdAAAAAABAAAAAAAAABFleHBpcmVzX2F0X2xlZGdlcgAAAAAAAAQAAAAAAAAAGGh1bWFuX2FwcHJvdmFsX3RocmVzaG9sZAAAAAsAAAAAAAAAFG1heF9jaGVja3BvaW50X2NvdW50AAAABAAAAAAAAAAUbWF4X2R1cmF0aW9uX2xlZGdlcnMAAAAEAAAAAAAAABBwZXJfc3RyZWFtX2xpbWl0AAAACwAAAAAAAAAOd2luZG93X2xlZGdlcnMAAAAAAAQAAAAAAAAADHdpbmRvd19saW1pdAAAAAs=",
        "AAAABQAAAAAAAAAAAAAADU1hbmRhdGVGdW5kZWQAAAAAAAACAAAAB21hbmRhdGUAAAAABmZ1bmRlZAAAAAAAAwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAQAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAADVBvbGljeVVwZGF0ZWQAAAAAAAACAAAAB21hbmRhdGUAAAAADnBvbGljeV91cGRhdGVkAAAAAAABAAAAAAAAAAVvd25lcgAAAAAAABMAAAABAAAAAg==",
        "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",
        "AAAAAAAAAAAAAAALZ2V0X2JhbGFuY2UAAAAAAQAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAMZ2V0X3Byb3Bvc2FsAAAAAQAAAAAAAAALcHJvcG9zYWxfaWQAAAAABgAAAAEAAAPpAAAH0AAAAA5TdHJlYW1Qcm9wb3NhbAAAAAAAAw==",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAUAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAFYWdlbnQAAAAAAAATAAAAAAAAAA9zdHJlYW1fY29udHJhY3QAAAAAEwAAAAAAAAAOYWxsb3dlZF9hc3NldHMAAAAAA+oAAAATAAAAAAAAAAZwb2xpY3kAAAAAB9AAAAANTWFuZGF0ZVBvbGljeQAAAAAAAAA=",
        "AAAAAAAAAAAAAAANc2V0X3JlY2lwaWVudAAAAAAAAAMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAAHYWxsb3dlZAAAAAABAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAANdXBkYXRlX3BvbGljeQAAAAAAAAIAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAGcG9saWN5AAAAAAfQAAAADU1hbmRhdGVQb2xpY3kAAAAAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAOZXhlY3V0ZV9zdHJlYW0AAAAAAAMAAAAAAAAABWFnZW50AAAAAAAAEwAAAAAAAAAKcmVxdWVzdF9pZAAAAAAD7gAAACAAAAAAAAAABnBhcmFtcwAAAAAH0AAAAAxTdHJlYW1QYXJhbXMAAAABAAAD6QAAAAYAAAAD",
        "AAAAAAAAAAAAAAAOcHJvcG9zZV9zdHJlYW0AAAAAAAMAAAAAAAAABWFnZW50AAAAAAAAEwAAAAAAAAAKcmVxdWVzdF9pZAAAAAAD7gAAACAAAAAAAAAABnBhcmFtcwAAAAAH0AAAAAxTdHJlYW1QYXJhbXMAAAABAAAD6QAAAAYAAAAD",
        "AAAAAAAAAAAAAAAPaXNfcmVxdWVzdF91c2VkAAAAAAEAAAAAAAAACnJlcXVlc3RfaWQAAAAAA+4AAAAgAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAAPcmVqZWN0X3Byb3Bvc2FsAAAAAAIAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAALcHJvcG9zYWxfaWQAAAAABgAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAAPd2l0aGRyYXdfdW51c2VkAAAAAAQAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAC2Rlc3RpbmF0aW9uAAAAABMAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAQZ2V0X3NwZW5kX3dpbmRvdwAAAAAAAAABAAAH0AAAAAtTcGVuZFdpbmRvdwA=",
        "AAAAAAAAAAAAAAAQaXNfYXNzZXRfYWxsb3dlZAAAAAEAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAEAAAAB",
        "AAAAAAAAAAAAAAASYXBwcm92ZV9jaGVja3BvaW50AAAAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAYAAAAAAAAABWluZGV4AAAAAAAABAAAAAEAAAPpAAAABgAAAAM=",
        "AAAAAAAAAAAAAAATYXBwcm92ZV9hbmRfZXhlY3V0ZQAAAAACAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAAC3Byb3Bvc2FsX2lkAAAAAAYAAAABAAAD6QAAAAYAAAAD",
        "AAAAAAAAAAAAAAAUaXNfcmVjaXBpZW50X2FsbG93ZWQAAAABAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAQAAAAE=",
        "AAAAAgAAAAAAAAAAAAAACENhdGVnb3J5AAAABgAAAAAAAAAAAAAACUZyZWVsYW5jZQAAAAAAAAAAAAAAAAAABlNhbGFyeQAAAAAAAAAAAAAAAAAGQm91bnR5AAAAAAAAAAAAAAAAAAVHcmFudAAAAAAAAAAAAAAAAAAACUFnZW50VGFzawAAAAAAAAAAAAAAAAAADFN1YnNjcmlwdGlvbg==",
        "AAAAAQAAAAAAAAAAAAAADFN0cmVhbVJlY29yZAAAABIAAAAAAAAAGGFwcHJvdmFsX3RpbWVvdXRfbGVkZ2VycwAAAAQAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAAAAAAIY2F0ZWdvcnkAAAfQAAAACENhdGVnb3J5AAAAAAAAABBjaGVja3BvaW50X2NvdW50AAAABAAAAAAAAAAXY2hlY2twb2ludF9zcGFuX2xlZGdlcnMAAAAABAAAAAAAAAAQZHVyYXRpb25fbGVkZ2VycwAAAAQAAAAAAAAAAmlkAAAAAAAGAAAAAAAAABBwYXVzZWRfYXRfbGVkZ2VyAAAABAAAAAAAAAAXcGF1c2VkX2R1cmF0aW9uX2xlZGdlcnMAAAAABAAAAAAAAAAPcmF0ZV9wZXJfbGVkZ2VyAAAAAAsAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAAAAAAABnNlbmRlcgAAAAAAEwAAAAAAAAAMc3RhcnRfbGVkZ2VyAAAABAAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADFN0cmVhbVN0YXR1cwAAAAAAAAAFdGl0bGUAAAAAAAAQAAAAAAAAAA90b3RhbF9kZXBvc2l0ZWQAAAAACwAAAAAAAAAPdG90YWxfd2l0aGRyYXduAAAAAAsAAAAAAAAAGHdpdGhkcmF3YWJsZV9jYXBfcGVyY2VudAAAAAQ=",
        "AAAAAgAAAAAAAAAAAAAADFN0cmVhbVN0YXR1cwAAAAQAAAAAAAAAAAAAAAZBY3RpdmUAAAAAAAAAAAAAAAAABlBhdXNlZAAAAAAAAAAAAAAAAAAJQ29tcGxldGVkAAAAAAAAAAAAAAAAAAAJQ2FuY2VsbGVkAAAA",
        "AAAAAQAAAAAAAAAAAAAAEENoZWNrcG9pbnRSZWNvcmQAAAAIAAAAAAAAAAhhcHByb3ZlZAAAAAEAAAAAAAAADmF0dGVzdGF0aW9uX2lkAAAAAAAGAAAAAAAAAA1hdXRvX2FwcHJvdmVkAAAAAAAAAQAAAAAAAAAKZHVlX2xlZGdlcgAAAAAABAAAAAAAAAANZXZpZGVuY2VfaGFzaAAAAAAAA+4AAAAgAAAAAAAAAAVpbmRleAAAAAAAAAQAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAYAAAAAAAAACXN1Ym1pdHRlZAAAAAAAAAE=",
        "AAAAAQAAAAAAAAAAAAAAEUF0dGVzdGF0aW9uUmVjb3JkAAAAAAAADQAAAAAAAAALYW1vdW50X3BhaWQAAAAACwAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAhjYXRlZ29yeQAAB9AAAAAIQ2F0ZWdvcnkAAAAAAAAAEGNoZWNrcG9pbnRfaW5kZXgAAAAEAAAAAAAAABBjbGllbnRfY29uZmlybWVkAAAAAQAAAAAAAAACaWQAAAAAAAYAAAAAAAAAEG1pbnRlZF9hdF9sZWRnZXIAAAAEAAAAAAAAABFwZXJpb2RfZW5kX2xlZGdlcgAAAAAAAAQAAAAAAAAAE3BlcmlvZF9zdGFydF9sZWRnZXIAAAAABAAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAAAAAAV0aXRsZQAAAAAAABA=" ]),
      options
    )
  }
  public readonly fromJSON = {
    pause: this.txFromJSON<Result<void>>,
        resume: this.txFromJSON<Result<void>>,
        revoke: this.txFromJSON<Result<void>>,
        deposit: this.txFromJSON<Result<void>>,
        set_agent: this.txFromJSON<Result<void>>,
        set_asset: this.txFromJSON<Result<void>>,
        get_config: this.txFromJSON<MandateConfig>,
        get_balance: this.txFromJSON<i128>,
        get_proposal: this.txFromJSON<Result<StreamProposal>>,
        set_recipient: this.txFromJSON<Result<void>>,
        update_policy: this.txFromJSON<Result<void>>,
        execute_stream: this.txFromJSON<Result<u64>>,
        propose_stream: this.txFromJSON<Result<u64>>,
        is_request_used: this.txFromJSON<boolean>,
        reject_proposal: this.txFromJSON<Result<void>>,
        withdraw_unused: this.txFromJSON<Result<void>>,
        get_spend_window: this.txFromJSON<SpendWindow>,
        is_asset_allowed: this.txFromJSON<boolean>,
        approve_checkpoint: this.txFromJSON<Result<u64>>,
        approve_and_execute: this.txFromJSON<Result<u64>>,
        is_recipient_allowed: this.txFromJSON<boolean>
  }
}