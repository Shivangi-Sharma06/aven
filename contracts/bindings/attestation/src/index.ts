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
    contractId: "CAUH2SDNOSEWNWCG33AD42ONZW7Y5SOQM6R4RHMCYP5GPOBBO43T5RFF",
  }
} as const

export const Errors = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"Unauthorized"},
  4: {message:"AttestationNotFound"},
  5: {message:"Overflow"},
  6: {message:"HistoryFull"},
  7: {message:"InvalidPayment"},
  8: {message:"InvalidLedgerRange"},
  9: {message:"TitleTooLong"}
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
   * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  init: ({admin, stream_contract}: {admin: string, stream_contract: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_attestation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_attestation: ({attestation_id}: {attestation_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<AttestationRecord>>>

  /**
   * Construct and simulate a mint_attestation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  mint_attestation: ({caller, stream_id, checkpoint_index, sender, recipient, amount_paid, asset, category, title, period_start_ledger, period_end_ledger, client_confirmed}: {caller: string, stream_id: u64, checkpoint_index: u32, sender: string, recipient: string, amount_paid: i128, asset: string, category: Category, title: string, period_start_ledger: u32, period_end_ledger: u32, client_confirmed: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a verify_attestation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  verify_attestation: ({attestation_id}: {attestation_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a get_recipient_attestations transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_recipient_attestations: ({recipient}: {recipient: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>

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
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACQAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAAMVW5hdXRob3JpemVkAAAAAwAAAAAAAAATQXR0ZXN0YXRpb25Ob3RGb3VuZAAAAAAEAAAAAAAAAAhPdmVyZmxvdwAAAAUAAAAAAAAAC0hpc3RvcnlGdWxsAAAAAAYAAAAAAAAADkludmFsaWRQYXltZW50AAAAAAAHAAAAAAAAABJJbnZhbGlkTGVkZ2VyUmFuZ2UAAAAAAAgAAAAAAAAADFRpdGxlVG9vTG9uZwAAAAk=",
        "AAAAAAAAAAAAAAAEaW5pdAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAPc3RyZWFtX2NvbnRyYWN0AAAAABMAAAABAAAD6QAAAAIAAAAD",
        "AAAABQAAAAAAAAAAAAAAEUF0dGVzdGF0aW9uTWludGVkAAAAAAAAAQAAABJhdHRlc3RhdGlvbl9taW50ZWQAAAAAAAYAAAAAAAAADmF0dGVzdGF0aW9uX2lkAAAAAAAGAAAAAQAAAAAAAAAJc3RyZWFtX2lkAAAAAAAABgAAAAEAAAAAAAAAEGNoZWNrcG9pbnRfaW5kZXgAAAAEAAAAAQAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAAAAAAAC2Ftb3VudF9wYWlkAAAAAAsAAAAAAAAAAAAAABBjbGllbnRfY29uZmlybWVkAAAAAQAAAAAAAAAC",
        "AAAAAAAAAAAAAAAPZ2V0X2F0dGVzdGF0aW9uAAAAAAEAAAAAAAAADmF0dGVzdGF0aW9uX2lkAAAAAAAGAAAAAQAAA+kAAAfQAAAAEUF0dGVzdGF0aW9uUmVjb3JkAAAAAAAAAw==",
        "AAAAAAAAAAAAAAAQbWludF9hdHRlc3RhdGlvbgAAAAwAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAJc3RyZWFtX2lkAAAAAAAABgAAAAAAAAAQY2hlY2twb2ludF9pbmRleAAAAAQAAAAAAAAABnNlbmRlcgAAAAAAEwAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAALYW1vdW50X3BhaWQAAAAACwAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAhjYXRlZ29yeQAAB9AAAAAIQ2F0ZWdvcnkAAAAAAAAABXRpdGxlAAAAAAAAEAAAAAAAAAATcGVyaW9kX3N0YXJ0X2xlZGdlcgAAAAAEAAAAAAAAABFwZXJpb2RfZW5kX2xlZGdlcgAAAAAAAAQAAAAAAAAAEGNsaWVudF9jb25maXJtZWQAAAABAAAAAQAAA+kAAAAGAAAAAw==",
        "AAAAAAAAAAAAAAASdmVyaWZ5X2F0dGVzdGF0aW9uAAAAAAABAAAAAAAAAA5hdHRlc3RhdGlvbl9pZAAAAAAABgAAAAEAAAAB",
        "AAAAAAAAAAAAAAAaZ2V0X3JlY2lwaWVudF9hdHRlc3RhdGlvbnMAAAAAAAEAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAABAAAD6gAAAAY=",
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
        get_attestation: this.txFromJSON<Result<AttestationRecord>>,
        mint_attestation: this.txFromJSON<Result<u64>>,
        verify_attestation: this.txFromJSON<boolean>,
        get_recipient_attestations: this.txFromJSON<Array<u64>>
  }
}