# Work stream contract

This is the replacement payment stream for Aven work sessions. It is intentionally separate from the deployed legacy stream contract so the old contract remains available while this one is reviewed and deployed.

## Payment flow

1. A client creates a funded stream for a worker.
2. The Aven verifier records a completed work session and its exact calculated amount.
3. The client can approve or dispute that session during the review window.
4. The worker withdraws the exact recorded amount after approval. If the client does nothing, the worker may withdraw after the review window ends.
5. A disputed session stays locked until the configured arbitrator accepts or rejects it.

There is no free-form withdrawal method. A session cannot be recorded twice, and the verifier cannot reserve more than the stream has earned.

## Build and test

From the `contracts` directory:

```sh
cargo test -p work_stream_contract
stellar contract build --package work_stream_contract
```

## Testnet deployment

The admin, verifier and arbitrator are set atomically when the contract is deployed:

```sh
stellar contract deploy \
  --wasm target/wasm32v1-none/release/work_stream_contract.wasm \
  --source YOUR_DEPLOYER_IDENTITY \
  --network testnet \
  -- \
  --admin YOUR_ADMIN_ADDRESS \
  --verifier YOUR_VERIFIER_ADDRESS \
  --arbitrator YOUR_ARBITRATOR_ADDRESS
```

Use separate testnet accounts for the verifier and arbitrator. The verifier key belongs in the server-side release service, never in the browser or the npm package. The arbitrator account is only needed when a client disputes a work session.
