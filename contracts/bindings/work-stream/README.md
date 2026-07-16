# Work stream TypeScript binding

This package is generated from `work_stream_contract.wasm`. It exposes typed calls for creating streams, recording verified sessions, reviewing claims and withdrawing approved payments.

The binding does not contain a contract address yet because the contract has not been deployed. After the testnet deployment, regenerate it from the deployed contract so the testnet network entry is included:

```sh
stellar contract bindings typescript \
  --contract-id YOUR_NEW_CONTRACT_ID \
  --network testnet \
  --output-dir contracts/bindings/work-stream \
  --overwrite
```

The dashboard should switch to this binding only after the new contract ID has been added to its environment configuration. Until then, the current stream binding continues to point at the legacy testnet contract.
