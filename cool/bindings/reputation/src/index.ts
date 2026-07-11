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
    contractId: "CBAJXRTE37SREIBIL5FP3J6BJV2VTMCHHQJJIS5W4IQK4BZ6UANKGSVL",
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

export const Errors = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"Unauthorized"},
  4: {message:"AttestationNotFound"},
  5: {message:"Overflow"},
  6: {message:"HistoryFull"}
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
   * Construct and simulate a verify_claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Integrator-facing gate. Any external platform can call this to
   * check "does this address meet a minimum bar" without needing to
   * understand the scoring internals at all.
   */
  verify_claim: ({attestation_contract, recipient, minimum_score}: {attestation_contract: string, recipient: string, minimum_score: i128}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a compute_score transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Recomputes a score live from on-chain attestation history every
   * single call. Nothing is ever cached or stored, so a score can never
   * be frozen at a high value - it always reflects current chain state.
   */
  compute_score: ({attestation_contract, recipient}: {attestation_contract: string, recipient: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_score_breakdown transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_score_breakdown: ({attestation_contract, recipient}: {attestation_contract: string, recipient: string}, options?: MethodOptions) => Promise<AssembledTransaction<ScoreBreakdown>>

  /**
   * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * One-time setup. Stores the single address allowed to mint
   * attestations. This is the entire trust boundary of the protocol -
   * nothing else in this contract needs to be locked down as tightly.
   */
  init: ({admin, stream_contract}: {admin: string, stream_contract: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_attestation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_attestation: ({attestation_id}: {attestation_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<AttestationRecord>>>

  /**
   * Construct and simulate a mint_attestation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Mints a permanent Work Attestation. `caller` MUST be the registered
   * StreamContract address, AND that same address must satisfy
   * `require_auth()`.
   */
  mint_attestation: ({caller, stream_id, sender, recipient, total_paid, asset, category, title, start_ledger, end_ledger}: {caller: string, stream_id: u64, sender: string, recipient: string, total_paid: i128, asset: string, category: Category, title: string, start_ledger: u32, end_ledger: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a verify_attestation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Never panics on a missing id - returns false so verifier UIs can
   * render a clean "not found" state instead of crashing.
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
      new ContractSpec([ "AAAAAAAAAKdJbnRlZ3JhdG9yLWZhY2luZyBnYXRlLiBBbnkgZXh0ZXJuYWwgcGxhdGZvcm0gY2FuIGNhbGwgdGhpcyB0bwpjaGVjayAiZG9lcyB0aGlzIGFkZHJlc3MgbWVldCBhIG1pbmltdW0gYmFyIiB3aXRob3V0IG5lZWRpbmcgdG8KdW5kZXJzdGFuZCB0aGUgc2NvcmluZyBpbnRlcm5hbHMgYXQgYWxsLgAAAAAMdmVyaWZ5X2NsYWltAAAAAwAAAAAAAAAUYXR0ZXN0YXRpb25fY29udHJhY3QAAAATAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAA1taW5pbXVtX3Njb3JlAAAAAAAACwAAAAEAAAAB",
        "AAAAAAAAAMdSZWNvbXB1dGVzIGEgc2NvcmUgbGl2ZSBmcm9tIG9uLWNoYWluIGF0dGVzdGF0aW9uIGhpc3RvcnkgZXZlcnkKc2luZ2xlIGNhbGwuIE5vdGhpbmcgaXMgZXZlciBjYWNoZWQgb3Igc3RvcmVkLCBzbyBhIHNjb3JlIGNhbiBuZXZlcgpiZSBmcm96ZW4gYXQgYSBoaWdoIHZhbHVlIC0gaXQgYWx3YXlzIHJlZmxlY3RzIGN1cnJlbnQgY2hhaW4gc3RhdGUuAAAAAA1jb21wdXRlX3Njb3JlAAAAAAAAAgAAAAAAAAAUYXR0ZXN0YXRpb25fY29udHJhY3QAAAATAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAQAAAAs=",
        "AAAAAQAAAAAAAAAAAAAADlNjb3JlQnJlYWtkb3duAAAAAAAHAAAAAAAAAAphZ2VudF90YXNrAAAAAAALAAAAAAAAAAZib3VudHkAAAAAAAsAAAAAAAAACWZyZWVsYW5jZQAAAAAAAAsAAAAAAAAABWdyYW50AAAAAAAACwAAAAAAAAAGc2FsYXJ5AAAAAAALAAAAAAAAAAxzdWJzY3JpcHRpb24AAAALAAAAAAAAAAV0b3RhbAAAAAAAAAs=",
        "AAAAAAAAAAAAAAATZ2V0X3Njb3JlX2JyZWFrZG93bgAAAAACAAAAAAAAABRhdHRlc3RhdGlvbl9jb250cmFjdAAAABMAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAABAAAH0AAAAA5TY29yZUJyZWFrZG93bgAA",
        "AAAAAAAAAL1PbmUtdGltZSBzZXR1cC4gU3RvcmVzIHRoZSBzaW5nbGUgYWRkcmVzcyBhbGxvd2VkIHRvIG1pbnQKYXR0ZXN0YXRpb25zLiBUaGlzIGlzIHRoZSBlbnRpcmUgdHJ1c3QgYm91bmRhcnkgb2YgdGhlIHByb3RvY29sIC0Kbm90aGluZyBlbHNlIGluIHRoaXMgY29udHJhY3QgbmVlZHMgdG8gYmUgbG9ja2VkIGRvd24gYXMgdGlnaHRseS4AAAAAAAAEaW5pdAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAPc3RyZWFtX2NvbnRyYWN0AAAAABMAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABgAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAAMVW5hdXRob3JpemVkAAAAAwAAAAAAAAATQXR0ZXN0YXRpb25Ob3RGb3VuZAAAAAAEAAAAAAAAAAhPdmVyZmxvdwAAAAUAAAAAAAAAC0hpc3RvcnlGdWxsAAAAAAY=",
        "AAAAAAAAAAAAAAAPZ2V0X2F0dGVzdGF0aW9uAAAAAAEAAAAAAAAADmF0dGVzdGF0aW9uX2lkAAAAAAAGAAAAAQAAA+kAAAfQAAAAEUF0dGVzdGF0aW9uUmVjb3JkAAAAAAAAAw==",
        "AAAAAAAAAJBNaW50cyBhIHBlcm1hbmVudCBXb3JrIEF0dGVzdGF0aW9uLiBgY2FsbGVyYCBNVVNUIGJlIHRoZSByZWdpc3RlcmVkClN0cmVhbUNvbnRyYWN0IGFkZHJlc3MsIEFORCB0aGF0IHNhbWUgYWRkcmVzcyBtdXN0IHNhdGlzZnkKYHJlcXVpcmVfYXV0aCgpYC4AAAAQbWludF9hdHRlc3RhdGlvbgAAAAoAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAJc3RyZWFtX2lkAAAAAAAABgAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAAp0b3RhbF9wYWlkAAAAAAALAAAAAAAAAAVhc3NldAAAAAAAABMAAAAAAAAACGNhdGVnb3J5AAAH0AAAAAhDYXRlZ29yeQAAAAAAAAAFdGl0bGUAAAAAAAAQAAAAAAAAAAxzdGFydF9sZWRnZXIAAAAEAAAAAAAAAAplbmRfbGVkZ2VyAAAAAAAEAAAAAQAAA+kAAAAGAAAAAw==",
        "AAAAAAAAAHZOZXZlciBwYW5pY3Mgb24gYSBtaXNzaW5nIGlkIC0gcmV0dXJucyBmYWxzZSBzbyB2ZXJpZmllciBVSXMgY2FuCnJlbmRlciBhIGNsZWFuICJub3QgZm91bmQiIHN0YXRlIGluc3RlYWQgb2YgY3Jhc2hpbmcuAAAAAAASdmVyaWZ5X2F0dGVzdGF0aW9uAAAAAAABAAAAAAAAAA5hdHRlc3RhdGlvbl9pZAAAAAAABgAAAAEAAAAB",
        "AAAAAAAAAAAAAAAaZ2V0X3JlY2lwaWVudF9hdHRlc3RhdGlvbnMAAAAAAAEAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAABAAAD6gAAAAY=",
        "AAAAAgAAAAAAAAAAAAAACENhdGVnb3J5AAAABgAAAAAAAAAAAAAACUZyZWVsYW5jZQAAAAAAAAAAAAAAAAAABlNhbGFyeQAAAAAAAAAAAAAAAAAGQm91bnR5AAAAAAAAAAAAAAAAAAVHcmFudAAAAAAAAAAAAAAAAAAACUFnZW50VGFzawAAAAAAAAAAAAAAAAAADFN1YnNjcmlwdGlvbg==",
        "AAAAAQAAAAAAAAAAAAAADFN0cmVhbVJlY29yZAAAABAAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAAAAAAOYXR0ZXN0YXRpb25faWQAAAAAAAYAAAAAAAAACGNhdGVnb3J5AAAH0AAAAAhDYXRlZ29yeQAAAAAAAAAQZHVyYXRpb25fbGVkZ2VycwAAAAQAAAA7MCBtZWFucyAibm8gYXR0ZXN0YXRpb24gbWludGVkIHlldCIgKGlkIDAgaXMgbmV2ZXIgaXNzdWVkKS4AAAAAD2hhc19hdHRlc3RhdGlvbgAAAAABAAAAAAAAAAJpZAAAAAAABgAAAAAAAAAQcGF1c2VkX2F0X2xlZGdlcgAAAAQAAABfMCBtZWFucyAibm90IGN1cnJlbnRseSBwYXVzZWQiLiBBbnkgb3RoZXIgdmFsdWUgaXMgdGhlIGxlZGdlciBhdAp3aGljaCB0aGUgY3VycmVudCBwYXVzZSBiZWdhbi4AAAAAF3BhdXNlZF9kdXJhdGlvbl9sZWRnZXJzAAAAAAQAAAClQW1vdW50IGVhcm5lZCBwZXIgbGVkZ2VyIChhbHJlYWR5IGNvbnZlcnRlZCBmcm9tIHRoZSBwZXItc2Vjb25kIHJhdGUKc3VwcGxpZWQgYXQgY3JlYXRpb24gdGltZSkuIFN0b3JlZCBzbyBvbi1jaGFpbiBtYXRoIGlzIGEgc2luZ2xlCm11bHRpcGxpY2F0aW9uIHdpdGggbm8gZGl2aXNpb24uAAAAAAAAD3JhdGVfcGVyX2xlZGdlcgAAAAALAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAAZzZW5kZXIAAAAAABMAAAAAAAAADHN0YXJ0X2xlZGdlcgAAAAQAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAxTdHJlYW1TdGF0dXMAAAAAAAAABXRpdGxlAAAAAAAAEAAAAAAAAAAPdG90YWxfZGVwb3NpdGVkAAAAAAsAAAAAAAAAD3RvdGFsX3dpdGhkcmF3bgAAAAAL",
        "AAAAAgAAAAAAAAAAAAAADFN0cmVhbVN0YXR1cwAAAAQAAAAAAAAAAAAAAAZBY3RpdmUAAAAAAAAAAAAAAAAABlBhdXNlZAAAAAAAAAAAAAAAAAAJQ29tcGxldGVkAAAAAAAAAAAAAAAAAAAJQ2FuY2VsbGVkAAAA",
        "AAAAAQAAAAAAAAAAAAAAEUF0dGVzdGF0aW9uUmVjb3JkAAAAAAAACwAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAhjYXRlZ29yeQAAB9AAAAAIQ2F0ZWdvcnkAAAAAAAAACmVuZF9sZWRnZXIAAAAAAAQAAAAAAAAAAmlkAAAAAAAGAAAAAAAAABBtaW50ZWRfYXRfbGVkZ2VyAAAABAAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAAxzdGFydF9sZWRnZXIAAAAEAAAAAAAAAAlzdHJlYW1faWQAAAAAAAAGAAAAAAAAAAV0aXRsZQAAAAAAABAAAAAAAAAACnRvdGFsX3BhaWQAAAAAAAs=" ]),
      options
    )
  }
  public readonly fromJSON = {
    verify_claim: this.txFromJSON<boolean>,
        compute_score: this.txFromJSON<i128>,
        get_score_breakdown: this.txFromJSON<ScoreBreakdown>,
        init: this.txFromJSON<Result<void>>,
        get_attestation: this.txFromJSON<Result<AttestationRecord>>,
        mint_attestation: this.txFromJSON<Result<u64>>,
        verify_attestation: this.txFromJSON<boolean>,
        get_recipient_attestations: this.txFromJSON<Array<u64>>
  }
}