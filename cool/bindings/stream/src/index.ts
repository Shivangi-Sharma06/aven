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
    contractId: "CCPHFGDKV2SOL5SUFN3WPM7DVNMYAJODH63YIA2VCS5UFRW57Z7FNKJ4",
  }
} as const

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
  14: {message:"HistoryFull"}
}

export type Category = {tag: "Freelance", values: void} | {tag: "Salary", values: void} | {tag: "Bounty", values: void} | {tag: "Grant", values: void} | {tag: "AgentTask", values: void} | {tag: "Subscription", values: void};


export interface StreamRecord {
  asset: string;
  attestation_id: u64;
  category: Category;
  duration_ledgers: u32;
  /**
 * 0 means "no attestation minted yet" (id 0 is never issued).
 */
has_attestation: boolean;
  id: u64;
  paused_at_ledger: u32;
  /**
 * 0 means "not currently paused". Any other value is the ledger at
 * which the current pause began.
 */
paused_duration_ledgers: u32;
  /**
 * Amount earned per ledger (already converted from the per-second rate
 * supplied at creation time). Stored so on-chain math is a single
 * multiplication with no division.
 */
rate_per_ledger: i128;
  recipient: string;
  sender: string;
  start_ledger: u32;
  status: StreamStatus;
  title: string;
  total_deposited: i128;
  total_withdrawn: i128;
}

export type StreamStatus = {tag: "Active", values: void} | {tag: "Paused", values: void} | {tag: "Completed", values: void} | {tag: "Cancelled", values: void};


export interface AttestationRecord {
  asset: string;
  category: Category;
  end_ledger: u32;
  id: u64;
  minted_at_ledger: u32;
  recipient: string;
  sender: string;
  start_ledger: u32;
  stream_id: u64;
  title: string;
  total_paid: i128;
}

export interface Client {
  /**
   * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * One-time setup. Stores the admin (upgrade coordination only - the
   * admin never has access to user funds) and the address of the
   * AttestationContract that this contract is allowed to call into on
   * stream completion.
   */
  init: ({admin, attestation_contract}: {admin: string, attestation_contract: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Recipient withdraws whatever has been earned but not yet withdrawn.
   * If the stream's duration has fully elapsed, this call also finalizes
   * the stream and triggers attestation minting.
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
   * Sender cancels the stream. The recipient is paid whatever they had
   * already earned; every remaining unstreamed unit returns to the
   * sender. The two payouts always sum to exactly
   * `total_deposited - total_withdrawn(before cancel)`.
   */
  cancel_stream: ({stream_id, caller}: {stream_id: u64, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Creates a new stream. Pulls `total_deposited` of `asset` from
   * `sender` into this contract via the SAC token interface. Funds are
   * only ever released via withdraw/cancel/complete - never on creation.
   */
  create_stream: ({sender, recipient, rate_per_second, asset, total_deposited, duration_ledgers, category, title}: {sender: string, recipient: string, rate_per_second: i128, asset: string, total_deposited: i128, duration_ledgers: u32, category: Category, title: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a resume_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  resume_stream: ({stream_id, caller}: {stream_id: u64, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a compute_earned transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Read-only view of the currently withdrawable amount. Safe to call
   * from the frontend on every tick - it touches no storage writes.
   */
  compute_earned: ({stream_id}: {stream_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a get_sender_streams transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_sender_streams: ({sender}: {sender: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>

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
      new ContractSpec([ "AAAAAAAAANNPbmUtdGltZSBzZXR1cC4gU3RvcmVzIHRoZSBhZG1pbiAodXBncmFkZSBjb29yZGluYXRpb24gb25seSAtIHRoZQphZG1pbiBuZXZlciBoYXMgYWNjZXNzIHRvIHVzZXIgZnVuZHMpIGFuZCB0aGUgYWRkcmVzcyBvZiB0aGUKQXR0ZXN0YXRpb25Db250cmFjdCB0aGF0IHRoaXMgY29udHJhY3QgaXMgYWxsb3dlZCB0byBjYWxsIGludG8gb24Kc3RyZWFtIGNvbXBsZXRpb24uAAAAAARpbml0AAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAABRhdHRlc3RhdGlvbl9jb250cmFjdAAAABMAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAADgAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAALSW52YWxpZFJhdGUAAAAAAwAAAAAAAAAOSW52YWxpZERlcG9zaXQAAAAAAAQAAAAAAAAAD0ludmFsaWREdXJhdGlvbgAAAAAFAAAAAAAAAAxUaXRsZVRvb0xvbmcAAAAGAAAAAAAAABNJbnN1ZmZpY2llbnREZXBvc2l0AAAAAAcAAAAAAAAADlN0cmVhbU5vdEZvdW5kAAAAAAAIAAAAAAAAAAlOb3RTZW5kZXIAAAAAAAAJAAAAAAAAAAxOb3RSZWNpcGllbnQAAAAKAAAAAAAAAAtXcm9uZ1N0YXR1cwAAAAALAAAAAAAAABFOb3RoaW5nVG9XaXRoZHJhdwAAAAAAAAwAAAAAAAAACE92ZXJmbG93AAAADQAAAAAAAAALSGlzdG9yeUZ1bGwAAAAADg==",
        "AAAAAAAAALVSZWNpcGllbnQgd2l0aGRyYXdzIHdoYXRldmVyIGhhcyBiZWVuIGVhcm5lZCBidXQgbm90IHlldCB3aXRoZHJhd24uCklmIHRoZSBzdHJlYW0ncyBkdXJhdGlvbiBoYXMgZnVsbHkgZWxhcHNlZCwgdGhpcyBjYWxsIGFsc28gZmluYWxpemVzCnRoZSBzdHJlYW0gYW5kIHRyaWdnZXJzIGF0dGVzdGF0aW9uIG1pbnRpbmcuAAAAAAAACHdpdGhkcmF3AAAAAgAAAAAAAAAJc3RyZWFtX2lkAAAAAAAABgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAAAAAAAAKZ2V0X3N0cmVhbQAAAAAAAQAAAAAAAAAJc3RyZWFtX2lkAAAAAAAABgAAAAEAAAPpAAAH0AAAAAxTdHJlYW1SZWNvcmQAAAAD",
        "AAAAAAAAAAAAAAAMcGF1c2Vfc3RyZWFtAAAAAgAAAAAAAAAJc3RyZWFtX2lkAAAAAAAABgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAONTZW5kZXIgY2FuY2VscyB0aGUgc3RyZWFtLiBUaGUgcmVjaXBpZW50IGlzIHBhaWQgd2hhdGV2ZXIgdGhleSBoYWQKYWxyZWFkeSBlYXJuZWQ7IGV2ZXJ5IHJlbWFpbmluZyB1bnN0cmVhbWVkIHVuaXQgcmV0dXJucyB0byB0aGUKc2VuZGVyLiBUaGUgdHdvIHBheW91dHMgYWx3YXlzIHN1bSB0byBleGFjdGx5CmB0b3RhbF9kZXBvc2l0ZWQgLSB0b3RhbF93aXRoZHJhd24oYmVmb3JlIGNhbmNlbClgLgAAAAANY2FuY2VsX3N0cmVhbQAAAAAAAAIAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAYAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAMVDcmVhdGVzIGEgbmV3IHN0cmVhbS4gUHVsbHMgYHRvdGFsX2RlcG9zaXRlZGAgb2YgYGFzc2V0YCBmcm9tCmBzZW5kZXJgIGludG8gdGhpcyBjb250cmFjdCB2aWEgdGhlIFNBQyB0b2tlbiBpbnRlcmZhY2UuIEZ1bmRzIGFyZQpvbmx5IGV2ZXIgcmVsZWFzZWQgdmlhIHdpdGhkcmF3L2NhbmNlbC9jb21wbGV0ZSAtIG5ldmVyIG9uIGNyZWF0aW9uLgAAAAAAAA1jcmVhdGVfc3RyZWFtAAAAAAAACAAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAA9yYXRlX3Blcl9zZWNvbmQAAAAACwAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAA90b3RhbF9kZXBvc2l0ZWQAAAAACwAAAAAAAAAQZHVyYXRpb25fbGVkZ2VycwAAAAQAAAAAAAAACGNhdGVnb3J5AAAH0AAAAAhDYXRlZ29yeQAAAAAAAAAFdGl0bGUAAAAAAAAQAAAAAQAAA+kAAAAGAAAAAw==",
        "AAAAAAAAAAAAAAANcmVzdW1lX3N0cmVhbQAAAAAAAAIAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAYAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAIFSZWFkLW9ubHkgdmlldyBvZiB0aGUgY3VycmVudGx5IHdpdGhkcmF3YWJsZSBhbW91bnQuIFNhZmUgdG8gY2FsbApmcm9tIHRoZSBmcm9udGVuZCBvbiBldmVyeSB0aWNrIC0gaXQgdG91Y2hlcyBubyBzdG9yYWdlIHdyaXRlcy4AAAAAAAAOY29tcHV0ZV9lYXJuZWQAAAAAAAEAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAYAAAABAAAD6QAAAAsAAAAD",
        "AAAAAAAAAAAAAAASZ2V0X3NlbmRlcl9zdHJlYW1zAAAAAAABAAAAAAAAAAZzZW5kZXIAAAAAABMAAAABAAAD6gAAAAY=",
        "AAAAAAAAAAAAAAAVZ2V0X3JlY2lwaWVudF9zdHJlYW1zAAAAAAAAAQAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAEAAAPqAAAABg==",
        "AAAAAgAAAAAAAAAAAAAACENhdGVnb3J5AAAABgAAAAAAAAAAAAAACUZyZWVsYW5jZQAAAAAAAAAAAAAAAAAABlNhbGFyeQAAAAAAAAAAAAAAAAAGQm91bnR5AAAAAAAAAAAAAAAAAAVHcmFudAAAAAAAAAAAAAAAAAAACUFnZW50VGFzawAAAAAAAAAAAAAAAAAADFN1YnNjcmlwdGlvbg==",
        "AAAAAQAAAAAAAAAAAAAADFN0cmVhbVJlY29yZAAAABAAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAAAAAAOYXR0ZXN0YXRpb25faWQAAAAAAAYAAAAAAAAACGNhdGVnb3J5AAAH0AAAAAhDYXRlZ29yeQAAAAAAAAAQZHVyYXRpb25fbGVkZ2VycwAAAAQAAAA7MCBtZWFucyAibm8gYXR0ZXN0YXRpb24gbWludGVkIHlldCIgKGlkIDAgaXMgbmV2ZXIgaXNzdWVkKS4AAAAAD2hhc19hdHRlc3RhdGlvbgAAAAABAAAAAAAAAAJpZAAAAAAABgAAAAAAAAAQcGF1c2VkX2F0X2xlZGdlcgAAAAQAAABfMCBtZWFucyAibm90IGN1cnJlbnRseSBwYXVzZWQiLiBBbnkgb3RoZXIgdmFsdWUgaXMgdGhlIGxlZGdlciBhdAp3aGljaCB0aGUgY3VycmVudCBwYXVzZSBiZWdhbi4AAAAAF3BhdXNlZF9kdXJhdGlvbl9sZWRnZXJzAAAAAAQAAAClQW1vdW50IGVhcm5lZCBwZXIgbGVkZ2VyIChhbHJlYWR5IGNvbnZlcnRlZCBmcm9tIHRoZSBwZXItc2Vjb25kIHJhdGUKc3VwcGxpZWQgYXQgY3JlYXRpb24gdGltZSkuIFN0b3JlZCBzbyBvbi1jaGFpbiBtYXRoIGlzIGEgc2luZ2xlCm11bHRpcGxpY2F0aW9uIHdpdGggbm8gZGl2aXNpb24uAAAAAAAAD3JhdGVfcGVyX2xlZGdlcgAAAAALAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAAZzZW5kZXIAAAAAABMAAAAAAAAADHN0YXJ0X2xlZGdlcgAAAAQAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAxTdHJlYW1TdGF0dXMAAAAAAAAABXRpdGxlAAAAAAAAEAAAAAAAAAAPdG90YWxfZGVwb3NpdGVkAAAAAAsAAAAAAAAAD3RvdGFsX3dpdGhkcmF3bgAAAAAL",
        "AAAAAgAAAAAAAAAAAAAADFN0cmVhbVN0YXR1cwAAAAQAAAAAAAAAAAAAAAZBY3RpdmUAAAAAAAAAAAAAAAAABlBhdXNlZAAAAAAAAAAAAAAAAAAJQ29tcGxldGVkAAAAAAAAAAAAAAAAAAAJQ2FuY2VsbGVkAAAA",
        "AAAAAQAAAAAAAAAAAAAAEUF0dGVzdGF0aW9uUmVjb3JkAAAAAAAACwAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAhjYXRlZ29yeQAAB9AAAAAIQ2F0ZWdvcnkAAAAAAAAACmVuZF9sZWRnZXIAAAAAAAQAAAAAAAAAAmlkAAAAAAAGAAAAAAAAABBtaW50ZWRfYXRfbGVkZ2VyAAAABAAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAAxzdGFydF9sZWRnZXIAAAAEAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAAAAAAV0aXRsZQAAAAAAABAAAAAAAAAACnRvdGFsX3BhaWQAAAAAAAs=" ]),
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
        get_sender_streams: this.txFromJSON<Array<u64>>,
        get_recipient_streams: this.txFromJSON<Array<u64>>
  }
}