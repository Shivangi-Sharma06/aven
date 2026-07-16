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
  1: {message:"NotInitialized"},
  3: {message:"InvalidAmount"},
  4: {message:"InvalidRate"},
  5: {message:"InvalidDuration"},
  6: {message:"InvalidReviewWindow"},
  7: {message:"InvalidTitle"},
  8: {message:"InvalidSessionId"},
  9: {message:"StreamNotFound"},
  10: {message:"ClaimNotFound"},
  11: {message:"ClaimAlreadyExists"},
  12: {message:"WrongStatus"},
  13: {message:"NotClient"},
  14: {message:"NotWorker"},
  15: {message:"NotVerifier"},
  16: {message:"NotArbitrator"},
  17: {message:"AmountNotEarned"},
  18: {message:"ReviewStillOpen"},
  19: {message:"ClaimDisputed"},
  20: {message:"PendingClaims"},
  21: {message:"Overflow"},
  22: {message:"NotAdmin"},
  23: {message:"StreamStillRunning"}
}


export interface Stream {
  asset: string;
  client: string;
  deposited: i128;
  duration_ledgers: u32;
  id: u64;
  paid: i128;
  paused_at: u32;
  paused_ledgers: u32;
  rate_per_ledger: i128;
  reserved: i128;
  review_window_ledgers: u32;
  start_ledger: u32;
  status: StreamStatus;
  title: string;
  worker: string;
}


export interface WorkClaim {
  amount: i128;
  report_digest: Buffer;
  review_deadline: u32;
  session_id: string;
  status: ClaimStatus;
  stream_id: u64;
  submitted_at: u32;
}


export type ClaimStatus = {tag: "Pending", values: void} | {tag: "Approved", values: void} | {tag: "Disputed", values: void} | {tag: "Rejected", values: void} | {tag: "Paid", values: void};

export type StreamStatus = {tag: "Active", values: void} | {tag: "Paused", values: void} | {tag: "Closed", values: void};




export interface Client {
  /**
   * Construct and simulate a close transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  close: ({stream_id, client}: {stream_id: u64, client: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  pause: ({stream_id, client}: {stream_id: u64, client: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a earned transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  earned: ({stream_id}: {stream_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a resume transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  resume: ({stream_id, client}: {stream_id: u64, client: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  withdraw: ({stream_id, session_id, worker}: {stream_id: u64, session_id: string, worker: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a available transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  available: ({stream_id}: {stream_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a get_claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_claim: ({stream_id, session_id}: {stream_id: u64, session_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<WorkClaim>>>

  /**
   * Construct and simulate a get_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_stream: ({stream_id}: {stream_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Stream>>>

  /**
   * Construct and simulate a verify_work transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  verify_work: ({stream_id, session_id, amount, report_digest}: {stream_id: u64, session_id: string, amount: i128, report_digest: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_verifier transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_verifier: ({admin, verifier}: {admin: string, verifier: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a approve_claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  approve_claim: ({stream_id, session_id, client}: {stream_id: u64, session_id: string, client: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_stream: ({client, worker, asset, deposit, rate_per_second, duration_ledgers, review_window_ledgers, title}: {client: string, worker: string, asset: string, deposit: i128, rate_per_second: i128, duration_ledgers: u32, review_window_ledgers: u32, title: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a dispute_claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  dispute_claim: ({stream_id, session_id, client}: {stream_id: u64, session_id: string, client: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_arbitrator transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_arbitrator: ({admin, arbitrator}: {admin: string, arbitrator: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a resolve_dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  resolve_dispute: ({stream_id, session_id, approve, arbitrator}: {stream_id: u64, session_id: string, approve: boolean, arbitrator: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, verifier, arbitrator}: {admin: string, verifier: string, arbitrator: string},
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
    return ContractClient.deploy({admin, verifier, arbitrator}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "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",
        "AAAAAAAAAAAAAAALdmVyaWZ5X3dvcmsAAAAABAAAAAAAAAAJc3RyZWFtX2lkAAAAAAAABgAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAAEAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAA1yZXBvcnRfZGlnZXN0AAAAAAAD7gAAACAAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAMc2V0X3ZlcmlmaWVyAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAh2ZXJpZmllcgAAABMAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAIdmVyaWZpZXIAAAATAAAAAAAAAAphcmJpdHJhdG9yAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAANYXBwcm92ZV9jbGFpbQAAAAAAAAMAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAYAAAAAAAAACnNlc3Npb25faWQAAAAAABAAAAAAAAAABmNsaWVudAAAAAAAEwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAANY3JlYXRlX3N0cmVhbQAAAAAAAAgAAAAAAAAABmNsaWVudAAAAAAAEwAAAAAAAAAGd29ya2VyAAAAAAATAAAAAAAAAAVhc3NldAAAAAAAABMAAAAAAAAAB2RlcG9zaXQAAAAACwAAAAAAAAAPcmF0ZV9wZXJfc2Vjb25kAAAAAAsAAAAAAAAAEGR1cmF0aW9uX2xlZGdlcnMAAAAEAAAAAAAAABVyZXZpZXdfd2luZG93X2xlZGdlcnMAAAAAAAAEAAAAAAAAAAV0aXRsZQAAAAAAABAAAAABAAAD6QAAAAYAAAAD",
        "AAAAAAAAAAAAAAANZGlzcHV0ZV9jbGFpbQAAAAAAAAMAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAYAAAAAAAAACnNlc3Npb25faWQAAAAAABAAAAAAAAAABmNsaWVudAAAAAAAEwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAAOc2V0X2FyYml0cmF0b3IAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAKYXJiaXRyYXRvcgAAAAAAEwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAAPcmVzb2x2ZV9kaXNwdXRlAAAAAAQAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAYAAAAAAAAACnNlc3Npb25faWQAAAAAABAAAAAAAAAAB2FwcHJvdmUAAAAAAQAAAAAAAAAKYXJiaXRyYXRvcgAAAAAAEwAAAAEAAAPpAAAAAgAAAAM=" ]),
      options
    )
  }
  public readonly fromJSON = {
    close: this.txFromJSON<Result<i128>>,
        pause: this.txFromJSON<Result<void>>,
        earned: this.txFromJSON<Result<i128>>,
        resume: this.txFromJSON<Result<void>>,
        withdraw: this.txFromJSON<Result<i128>>,
        available: this.txFromJSON<Result<i128>>,
        get_claim: this.txFromJSON<Result<WorkClaim>>,
        get_stream: this.txFromJSON<Result<Stream>>,
        verify_work: this.txFromJSON<Result<void>>,
        set_verifier: this.txFromJSON<Result<void>>,
        approve_claim: this.txFromJSON<Result<void>>,
        create_stream: this.txFromJSON<Result<u64>>,
        dispute_claim: this.txFromJSON<Result<void>>,
        set_arbitrator: this.txFromJSON<Result<void>>,
        resolve_dispute: this.txFromJSON<Result<void>>
  }
}