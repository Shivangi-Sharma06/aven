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

export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CALFE5CJWUO4UXLPCOQHOTH7XTV2FSATTWE5XAB22O42BHBQS7HD32HV",
  },
} as const;




export const Errors = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"InvalidRate"},
  4: {message:"InvalidDeposit"},
  5: {message:"InvalidDuration"},
  6: {message:"TitleTooLong"},
  7: {message:"InsufficientDeposit"},
  8: {message:"StreamNotFound"},
  9: {message:"NotSender"},
  10: {message:"NotRecipient"},
  11: {message:"WrongStatus"},
  12: {message:"NothingToWithdraw"},
  13: {message:"Overflow"},
  14: {message:"HistoryFull"},
  15: {message:"InvalidCheckpointCount"},
  16: {message:"DurationNotDivisible"},
  17: {message:"InvalidCapPercent"},
  18: {message:"InvalidTimeout"},
  19: {message:"IndexOutOfRange"},
  20: {message:"CheckpointNotSubmitted"},
  21: {message:"CheckpointAlreadyFinalized"},
  22: {message:"InvalidRequestId"},
  23: {message:"InvalidAmount"},
  24: {message:"AmountExceedsWithdrawable"},
  25: {message:"WithdrawalNotFound"},
  26: {message:"WithdrawalAlreadyExists"},
  27: {message:"WithdrawalNotApproved"},
  28: {message:"WithdrawalDisputed"},
  29: {message:"WithdrawalApprovalRequired"}
}







export interface WithdrawalRecord {
  amount: i128;
  deadline_ledger: u32;
  request_id: string;
  requested_at_ledger: u32;
  status: WithdrawalStatus;
  stream_id: u64;
}

export type WithdrawalStatus = {tag: "Pending", values: void} | {tag: "Approved", values: void} | {tag: "Disputed", values: void} | {tag: "Withdrawn", values: void};







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
   * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  init: ({admin, attestation_contract}: {admin: string, attestation_contract: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  withdraw: ({stream_id, caller}: {stream_id: u64, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a get_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_stream: ({stream_id}: {stream_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<StreamRecord>>>

  /**
   * Construct and simulate a pause_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  pause_stream: ({stream_id, caller}: {stream_id: u64, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a cancel_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cancel_stream: ({stream_id, caller}: {stream_id: u64, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_stream: ({sender, recipient, rate_per_second, asset, total_deposited, duration_ledgers, checkpoint_count, withdrawable_cap_percent, approval_timeout_ledgers, category, title}: {sender: string, recipient: string, rate_per_second: i128, asset: string, total_deposited: i128, duration_ledgers: u32, checkpoint_count: u32, withdrawable_cap_percent: u32, approval_timeout_ledgers: u32, category: Category, title: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a resume_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  resume_stream: ({stream_id, caller}: {stream_id: u64, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a compute_earned transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  compute_earned: ({stream_id}: {stream_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a get_checkpoint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_checkpoint: ({stream_id, index}: {stream_id: u64, index: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<CheckpointRecord>>>

  /**
   * Construct and simulate a get_withdrawal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_withdrawal: ({stream_id, request_id}: {stream_id: u64, request_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<WithdrawalRecord>>>

  /**
   * Construct and simulate a compute_available transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  compute_available: ({stream_id}: {stream_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a submit_checkpoint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  submit_checkpoint: ({stream_id, worker, index, evidence_hash}: {stream_id: u64, worker: string, index: u32, evidence_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a withdraw_approved transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  withdraw_approved: ({stream_id, recipient, request_id}: {stream_id: u64, recipient: string, request_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a approve_checkpoint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  approve_checkpoint: ({stream_id, sender, index}: {stream_id: u64, sender: string, index: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a approve_withdrawal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  approve_withdrawal: ({stream_id, sender, request_id}: {stream_id: u64, sender: string, request_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a dispute_withdrawal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  dispute_withdrawal: ({stream_id, sender, request_id}: {stream_id: u64, sender: string, request_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_sender_streams transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_sender_streams: ({sender}: {sender: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>

  /**
   * Construct and simulate a request_withdrawal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  request_withdrawal: ({stream_id, recipient, request_id, amount}: {stream_id: u64, recipient: string, request_id: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a settle_checkpoints transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  settle_checkpoints: ({stream_id}: {stream_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a get_recipient_streams transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_recipient_streams: ({recipient}: {recipient: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
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
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAHQAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAALSW52YWxpZFJhdGUAAAAAAwAAAAAAAAAOSW52YWxpZERlcG9zaXQAAAAAAAQAAAAAAAAAD0ludmFsaWREdXJhdGlvbgAAAAAFAAAAAAAAAAxUaXRsZVRvb0xvbmcAAAAGAAAAAAAAABNJbnN1ZmZpY2llbnREZXBvc2l0AAAAAAcAAAAAAAAADlN0cmVhbU5vdEZvdW5kAAAAAAAIAAAAAAAAAAlOb3RTZW5kZXIAAAAAAAAJAAAAAAAAAAxOb3RSZWNpcGllbnQAAAAKAAAAAAAAAAtXcm9uZ1N0YXR1cwAAAAALAAAAAAAAABFOb3RoaW5nVG9XaXRoZHJhdwAAAAAAAAwAAAAAAAAACE92ZXJmbG93AAAADQAAAAAAAAALSGlzdG9yeUZ1bGwAAAAADgAAAAAAAAAWSW52YWxpZENoZWNrcG9pbnRDb3VudAAAAAAADwAAAAAAAAAURHVyYXRpb25Ob3REaXZpc2libGUAAAAQAAAAAAAAABFJbnZhbGlkQ2FwUGVyY2VudAAAAAAAABEAAAAAAAAADkludmFsaWRUaW1lb3V0AAAAAAASAAAAAAAAAA9JbmRleE91dE9mUmFuZ2UAAAAAEwAAAAAAAAAWQ2hlY2twb2ludE5vdFN1Ym1pdHRlZAAAAAAAFAAAAAAAAAAaQ2hlY2twb2ludEFscmVhZHlGaW5hbGl6ZWQAAAAAABUAAAAAAAAAEEludmFsaWRSZXF1ZXN0SWQAAAAWAAAAAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAAFwAAAAAAAAAZQW1vdW50RXhjZWVkc1dpdGhkcmF3YWJsZQAAAAAAABgAAAAAAAAAEldpdGhkcmF3YWxOb3RGb3VuZAAAAAAAGQAAAAAAAAAXV2l0aGRyYXdhbEFscmVhZHlFeGlzdHMAAAAAGgAAAAAAAAAVV2l0aGRyYXdhbE5vdEFwcHJvdmVkAAAAAAAAGwAAAAAAAAASV2l0aGRyYXdhbERpc3B1dGVkAAAAAAAcAAAAAAAAABpXaXRoZHJhd2FsQXBwcm92YWxSZXF1aXJlZAAA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",
        "AAAAAAAAAAAAAAANcmVzdW1lX3N0cmVhbQAAAAAAAAIAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAYAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAAOY29tcHV0ZV9lYXJuZWQAAAAAAAEAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAYAAAABAAAD6QAAAAsAAAAD",
        "AAAAAAAAAAAAAAAOZ2V0X2NoZWNrcG9pbnQAAAAAAAIAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAYAAAAAAAAABWluZGV4AAAAAAAABAAAAAEAAAPpAAAH0AAAABBDaGVja3BvaW50UmVjb3JkAAAAAw==",
        "AAAAAAAAAAAAAAAOZ2V0X3dpdGhkcmF3YWwAAAAAAAIAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAYAAAAAAAAACnJlcXVlc3RfaWQAAAAAABAAAAABAAAD6QAAB9AAAAAQV2l0aGRyYXdhbFJlY29yZAAAAAM=",
        "AAAAAAAAAAAAAAARY29tcHV0ZV9hdmFpbGFibGUAAAAAAAABAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAAAAAAAARc3VibWl0X2NoZWNrcG9pbnQAAAAAAAAEAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAAAAAAZ3b3JrZXIAAAAAABMAAAAAAAAABWluZGV4AAAAAAAABAAAAAAAAAANZXZpZGVuY2VfaGFzaAAAAAAAA+4AAAAgAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAARd2l0aGRyYXdfYXBwcm92ZWQAAAAAAAADAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAApyZXF1ZXN0X2lkAAAAAAAQAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAAAAAAAASYXBwcm92ZV9jaGVja3BvaW50AAAAAAADAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAAAAAAZzZW5kZXIAAAAAABMAAAAAAAAABWluZGV4AAAAAAAABAAAAAEAAAPpAAAABgAAAAM=",
        "AAAAAAAAAAAAAAASYXBwcm92ZV93aXRoZHJhd2FsAAAAAAADAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAAAAAAZzZW5kZXIAAAAAABMAAAAAAAAACnJlcXVlc3RfaWQAAAAAABAAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAASZGlzcHV0ZV93aXRoZHJhd2FsAAAAAAADAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAAAAAAZzZW5kZXIAAAAAABMAAAAAAAAACnJlcXVlc3RfaWQAAAAAABAAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAASZ2V0X3NlbmRlcl9zdHJlYW1zAAAAAAABAAAAAAAAAAZzZW5kZXIAAAAAABMAAAABAAAD6gAAAAY=",
        "AAAAAAAAAAAAAAAScmVxdWVzdF93aXRoZHJhd2FsAAAAAAAEAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAApyZXF1ZXN0X2lkAAAAAAAQAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAASc2V0dGxlX2NoZWNrcG9pbnRzAAAAAAABAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAQAAA+kAAAAEAAAAAw==",
        "AAAAAAAAAAAAAAAVZ2V0X3JlY2lwaWVudF9zdHJlYW1zAAAAAAAAAQAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAEAAAPqAAAABg==",
        "AAAAAgAAAAAAAAAAAAAACENhdGVnb3J5AAAABgAAAAAAAAAAAAAACUZyZWVsYW5jZQAAAAAAAAAAAAAAAAAABlNhbGFyeQAAAAAAAAAAAAAAAAAGQm91bnR5AAAAAAAAAAAAAAAAAAVHcmFudAAAAAAAAAAAAAAAAAAACUFnZW50VGFzawAAAAAAAAAAAAAAAAAADFN1YnNjcmlwdGlvbg==",
        "AAAAAQAAAAAAAAAAAAAADFN0cmVhbVJlY29yZAAAABIAAAAAAAAAGGFwcHJvdmFsX3RpbWVvdXRfbGVkZ2VycwAAAAQAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAAAAAAIY2F0ZWdvcnkAAAfQAAAACENhdGVnb3J5AAAAAAAAABBjaGVja3BvaW50X2NvdW50AAAABAAAAAAAAAAXY2hlY2twb2ludF9zcGFuX2xlZGdlcnMAAAAABAAAAAAAAAAQZHVyYXRpb25fbGVkZ2VycwAAAAQAAAAAAAAAAmlkAAAAAAAGAAAAAAAAABBwYXVzZWRfYXRfbGVkZ2VyAAAABAAAAAAAAAAXcGF1c2VkX2R1cmF0aW9uX2xlZGdlcnMAAAAABAAAAAAAAAAPcmF0ZV9wZXJfbGVkZ2VyAAAAAAsAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAAAAAAABnNlbmRlcgAAAAAAEwAAAAAAAAAMc3RhcnRfbGVkZ2VyAAAABAAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADFN0cmVhbVN0YXR1cwAAAAAAAAAFdGl0bGUAAAAAAAAQAAAAAAAAAA90b3RhbF9kZXBvc2l0ZWQAAAAACwAAAAAAAAAPdG90YWxfd2l0aGRyYXduAAAAAAsAAAAAAAAAGHdpdGhkcmF3YWJsZV9jYXBfcGVyY2VudAAAAAQ=",
        "AAAAAgAAAAAAAAAAAAAADFN0cmVhbVN0YXR1cwAAAAQAAAAAAAAAAAAAAAZBY3RpdmUAAAAAAAAAAAAAAAAABlBhdXNlZAAAAAAAAAAAAAAAAAAJQ29tcGxldGVkAAAAAAAAAAAAAAAAAAAJQ2FuY2VsbGVkAAAA",
        "AAAAAQAAAAAAAAAAAAAAEENoZWNrcG9pbnRSZWNvcmQAAAAIAAAAAAAAAAhhcHByb3ZlZAAAAAEAAAAAAAAADmF0dGVzdGF0aW9uX2lkAAAAAAAGAAAAAAAAAA1hdXRvX2FwcHJvdmVkAAAAAAAAAQAAAAAAAAAKZHVlX2xlZGdlcgAAAAAABAAAAAAAAAANZXZpZGVuY2VfaGFzaAAAAAAAA+4AAAAgAAAAAAAAAAVpbmRleAAAAAAAAAQAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAYAAAAAAAAACXN1Ym1pdHRlZAAAAAAAAAE=",
        "AAAAAQAAAAAAAAAAAAAAEUF0dGVzdGF0aW9uUmVjb3JkAAAAAAAADQAAAAAAAAALYW1vdW50X3BhaWQAAAAACwAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAhjYXRlZ29yeQAAB9AAAAAIQ2F0ZWdvcnkAAAAAAAAAEGNoZWNrcG9pbnRfaW5kZXgAAAAEAAAAAAAAABBjbGllbnRfY29uZmlybWVkAAAAAQAAAAAAAAACaWQAAAAAAAYAAAAAAAAAEG1pbnRlZF9hdF9sZWRnZXIAAAAEAAAAAAAAABFwZXJpb2RfZW5kX2xlZGdlcgAAAAAAAAQAAAAAAAAAE3BlcmlvZF9zdGFydF9sZWRnZXIAAAAABAAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAAAAAAV0aXRsZQAAAAAAABA=" ]),
      options
    )
  }
  public readonly fromJSON = {
    init: this.txFromJSON<Result<void>>,
        withdraw: this.txFromJSON<Result<i128>>,
        get_stream: this.txFromJSON<Result<StreamRecord>>,
        pause_stream: this.txFromJSON<Result<void>>,
        cancel_stream: this.txFromJSON<Result<void>>,
        create_stream: this.txFromJSON<Result<u64>>,
        resume_stream: this.txFromJSON<Result<void>>,
        compute_earned: this.txFromJSON<Result<i128>>,
        get_checkpoint: this.txFromJSON<Result<CheckpointRecord>>,
        get_withdrawal: this.txFromJSON<Result<WithdrawalRecord>>,
        compute_available: this.txFromJSON<Result<i128>>,
        submit_checkpoint: this.txFromJSON<Result<void>>,
        withdraw_approved: this.txFromJSON<Result<i128>>,
        approve_checkpoint: this.txFromJSON<Result<u64>>,
        approve_withdrawal: this.txFromJSON<Result<void>>,
        dispute_withdrawal: this.txFromJSON<Result<void>>,
        get_sender_streams: this.txFromJSON<Array<u64>>,
        request_withdrawal: this.txFromJSON<Result<void>>,
        settle_checkpoints: this.txFromJSON<Result<u32>>,
        get_recipient_streams: this.txFromJSON<Array<u64>>
  }
}
