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
    contractId: "CANK4E7GOFZT4D3U57RNT7QLQTNFGY7QNL6TQTWWKYBNHX7J6U54HO7E",
  }
} as const


export interface ScoreBreakdown {
  agent_task: i128;
  bounty: i128;
  freelance: i128;
  grant: i128;
  salary: i128;
  subscription: i128;
  total: i128;
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

export type AttestationKind = {tag: "Checkpoint", values: void} | {tag: "WorkSession", values: void} | {tag: "LegacyReviewed", values: void};


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
  active_duration_seconds: u64;
  amount_paid: i128;
  asset: string;
  auto_released: boolean;
  category: Category;
  checkpoint_index: u32;
  client_confirmed: boolean;
  id: u64;
  kind: AttestationKind;
  minted_at_ledger: u32;
  period_end_ledger: u32;
  period_start_ledger: u32;
  recipient: string;
  report_hash: Option<Buffer>;
  request_id: string;
  sender: string;
  stream_id: u64;
  title: string;
  verifier: Option<string>;
}

export interface Client {
  /**
   * Construct and simulate a verify_claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  verify_claim: ({attestation_contract, recipient, minimum_score}: {attestation_contract: string, recipient: string, minimum_score: i128}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a compute_score transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  compute_score: ({attestation_contract, recipient}: {attestation_contract: string, recipient: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_score_breakdown transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_score_breakdown: ({attestation_contract, recipient}: {attestation_contract: string, recipient: string}, options?: MethodOptions) => Promise<AssembledTransaction<ScoreBreakdown>>

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
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAADlNjb3JlQnJlYWtkb3duAAAAAAAHAAAAAAAAAAphZ2VudF90YXNrAAAAAAALAAAAAAAAAAZib3VudHkAAAAAAAsAAAAAAAAACWZyZWVsYW5jZQAAAAAAAAsAAAAAAAAABWdyYW50AAAAAAAACwAAAAAAAAAGc2FsYXJ5AAAAAAALAAAAAAAAAAxzdWJzY3JpcHRpb24AAAALAAAAAAAAAAV0b3RhbAAAAAAAAAs=",
        "AAAAAAAAAAAAAAAMdmVyaWZ5X2NsYWltAAAAAwAAAAAAAAAUYXR0ZXN0YXRpb25fY29udHJhY3QAAAATAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAA1taW5pbXVtX3Njb3JlAAAAAAAACwAAAAEAAAAB",
        "AAAAAAAAAAAAAAANY29tcHV0ZV9zY29yZQAAAAAAAAIAAAAAAAAAFGF0dGVzdGF0aW9uX2NvbnRyYWN0AAAAEwAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAEAAAAL",
        "AAAAAAAAAAAAAAATZ2V0X3Njb3JlX2JyZWFrZG93bgAAAAACAAAAAAAAABRhdHRlc3RhdGlvbl9jb250cmFjdAAAABMAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAABAAAH0AAAAA5TY29yZUJyZWFrZG93bgAA",
        "AAAAAgAAAAAAAAAAAAAACENhdGVnb3J5AAAABgAAAAAAAAAAAAAACUZyZWVsYW5jZQAAAAAAAAAAAAAAAAAABlNhbGFyeQAAAAAAAAAAAAAAAAAGQm91bnR5AAAAAAAAAAAAAAAAAAVHcmFudAAAAAAAAAAAAAAAAAAACUFnZW50VGFzawAAAAAAAAAAAAAAAAAADFN1YnNjcmlwdGlvbg==",
        "AAAAAQAAAAAAAAAAAAAADFN0cmVhbVJlY29yZAAAABIAAAAAAAAAGGFwcHJvdmFsX3RpbWVvdXRfbGVkZ2VycwAAAAQAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAAAAAAIY2F0ZWdvcnkAAAfQAAAACENhdGVnb3J5AAAAAAAAABBjaGVja3BvaW50X2NvdW50AAAABAAAAAAAAAAXY2hlY2twb2ludF9zcGFuX2xlZGdlcnMAAAAABAAAAAAAAAAQZHVyYXRpb25fbGVkZ2VycwAAAAQAAAAAAAAAAmlkAAAAAAAGAAAAAAAAABBwYXVzZWRfYXRfbGVkZ2VyAAAABAAAAAAAAAAXcGF1c2VkX2R1cmF0aW9uX2xlZGdlcnMAAAAABAAAAAAAAAAPcmF0ZV9wZXJfbGVkZ2VyAAAAAAsAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAAAAAAABnNlbmRlcgAAAAAAEwAAAAAAAAAMc3RhcnRfbGVkZ2VyAAAABAAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADFN0cmVhbVN0YXR1cwAAAAAAAAAFdGl0bGUAAAAAAAAQAAAAAAAAAA90b3RhbF9kZXBvc2l0ZWQAAAAACwAAAAAAAAAPdG90YWxfd2l0aGRyYXduAAAAAAsAAAAAAAAAGHdpdGhkcmF3YWJsZV9jYXBfcGVyY2VudAAAAAQ=",
        "AAAAAgAAAAAAAAAAAAAADFN0cmVhbVN0YXR1cwAAAAQAAAAAAAAAAAAAAAZBY3RpdmUAAAAAAAAAAAAAAAAABlBhdXNlZAAAAAAAAAAAAAAAAAAJQ29tcGxldGVkAAAAAAAAAAAAAAAAAAAJQ2FuY2VsbGVkAAAA",
        "AAAAAgAAAAAAAAAAAAAAD0F0dGVzdGF0aW9uS2luZAAAAAADAAAAAAAAAAAAAAAKQ2hlY2twb2ludAAAAAAAAAAAAAAAAAALV29ya1Nlc3Npb24AAAAAAAAAAAAAAAAOTGVnYWN5UmV2aWV3ZWQAAA==",
        "AAAAAQAAAAAAAAAAAAAAEENoZWNrcG9pbnRSZWNvcmQAAAAIAAAAAAAAAAhhcHByb3ZlZAAAAAEAAAAAAAAADmF0dGVzdGF0aW9uX2lkAAAAAAAGAAAAAAAAAA1hdXRvX2FwcHJvdmVkAAAAAAAAAQAAAAAAAAAKZHVlX2xlZGdlcgAAAAAABAAAAAAAAAANZXZpZGVuY2VfaGFzaAAAAAAAA+4AAAAgAAAAAAAAAAVpbmRleAAAAAAAAAQAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAYAAAAAAAAACXN1Ym1pdHRlZAAAAAAAAAE=",
        "AAAAAQAAAAAAAAAAAAAAEUF0dGVzdGF0aW9uUmVjb3JkAAAAAAAAEwAAAAAAAAAXYWN0aXZlX2R1cmF0aW9uX3NlY29uZHMAAAAABgAAAAAAAAALYW1vdW50X3BhaWQAAAAACwAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAA1hdXRvX3JlbGVhc2VkAAAAAAAAAQAAAAAAAAAIY2F0ZWdvcnkAAAfQAAAACENhdGVnb3J5AAAAAAAAABBjaGVja3BvaW50X2luZGV4AAAABAAAAAAAAAAQY2xpZW50X2NvbmZpcm1lZAAAAAEAAAAAAAAAAmlkAAAAAAAGAAAAAAAAAARraW5kAAAH0AAAAA9BdHRlc3RhdGlvbktpbmQAAAAAAAAAABBtaW50ZWRfYXRfbGVkZ2VyAAAABAAAAAAAAAARcGVyaW9kX2VuZF9sZWRnZXIAAAAAAAAEAAAAAAAAABNwZXJpb2Rfc3RhcnRfbGVkZ2VyAAAAAAQAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAAAAAAAC3JlcG9ydF9oYXNoAAAAA+gAAAPuAAAAIAAAAAAAAAAKcmVxdWVzdF9pZAAAAAAAEAAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAAAAAAV0aXRsZQAAAAAAABAAAAAAAAAACHZlcmlmaWVyAAAD6AAAABM=" ]),
      options
    )
  }
  public readonly fromJSON = {
    verify_claim: this.txFromJSON<boolean>,
        compute_score: this.txFromJSON<i128>,
        get_score_breakdown: this.txFromJSON<ScoreBreakdown>
  }
}