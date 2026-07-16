# Aven stream contract

This is the deployable Aven stream. The verified-work feature is additive: without a configured verifier it keeps the original reviewed-withdrawal behavior; after `set_verifier`, direct withdrawal requests are disabled and only verified sessions can open a payment review.

The existing interface remains available for stream creation, sender and recipient indexes, checkpoints, attestations, reputation inputs, pause, resume and cancellation.

## Build

```sh
stellar contract build --package stream_contract
stellar contract build --package attestation_contract
```

## Testnet deployment order

The attestation contract authorizes one stream address, so deploy both uninitialized contracts before initializing either one:

```sh
STREAM_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/stream_contract.wasm \
  --source-account aven-deployer \
  --network testnet)

ATTESTATION_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/attestation_contract.wasm \
  --source-account aven-deployer \
  --network testnet)

stellar contract invoke --id "$ATTESTATION_ID" --source-account aven-deployer --network testnet -- \
  init --admin aven-deployer --stream_contract "$STREAM_ID"

stellar contract invoke --id "$STREAM_ID" --source-account aven-deployer --network testnet -- \
  init --admin aven-deployer --attestation_contract "$ATTESTATION_ID"

stellar contract invoke --id "$STREAM_ID" --source-account aven-deployer --network testnet -- \
  set_verifier --admin aven-deployer --verifier aven-verifier
```

Then configure the app with `NEXT_PUBLIC_STREAM_CONTRACT_ID`, `NEXT_PUBLIC_ATTESTATION_CONTRACT_ID`, and the server-only `AVEN_VERIFIER_SECRET`.
