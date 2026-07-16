# Agent Mandate — Testnet Runbook

## What is implemented

The first Agent Mandate release uses one contract instance per owner-agent pair. The instance owns only its delegated budget and is recorded as the sender of every Stream it creates.

- The owner configures policy, deposits funds, manages recipients, approves high-value proposals, pauses, revokes, and recovers unused funds.
- The agent executes below-threshold streams or creates proposals above the approval threshold.
- A SHA-256 request ID is consumed once on-chain, making runner retries idempotent.
- Stream checkpoints, attestations, and reputation continue through the existing contracts.

The mandate factory is not part of this release. Deploy one instance manually and complete an end-to-end rehearsal before adding a factory or mainnet path.

## Build and binding generation

```bash
cd contracts
rustup target add wasm32v1-none
RUSTC="$HOME/.rustup/toolchains/stable-aarch64-apple-darwin/bin/rustc" \
  cargo build -p agent_mandate_contract --target wasm32v1-none --release

stellar contract bindings typescript \
  --wasm target/wasm32v1-none/release/agent_mandate_contract.wasm \
  --output-dir bindings/agent_mandate
```

The explicit `RUSTC` is only needed on machines where Homebrew Cargo and rustup's WASM target are installed in different toolchains.

## Manual testnet deployment

The repeatable helper scripts live in `contracts/scripts/`. Run `bash scripts/build-agent-mandate.sh`, then set the documented environment variables and run `bash scripts/deploy-agent-mandate-testnet.sh`. Use a Stellar CLI identity alias for `STELLAR_SOURCE`; do not place a seed in the script or shell history.

1. Install the WASM on Stellar testnet and retain the returned WASM hash.
2. Deploy an instance with constructor arguments for the owner, agent, existing Stream contract, initial allowed assets, and initial policy.
3. Enter the resulting `C…` address in `/agents` while connected with the owner wallet.
4. Verify that `owner`, `agent`, and `stream_contract` match the intended addresses before depositing.
5. Deposit a small testnet amount and allow one known recipient.
6. Start the runner with the matching agent key and mandate address.
7. Submit one below-threshold job, then one above-threshold job and approve it in the UI.
8. Submit and approve a checkpoint, withdraw as the worker, and confirm the resulting attestation and reputation update.
9. Pause the mandate and confirm execution fails. Revoke only at the end of the rehearsal because revocation is permanent.

## Runner configuration

Required environment variables:

| Variable | Purpose |
| --- | --- |
| `AGENT_MANDATE_ADDRESS` | Deployed per-agent mandate address |
| `AGENT_SECRET_KEY` | Agent signer; keep in a secret manager in production |
| `RUNNER_HMAC_SECRET` | At least 32 characters; authenticates job requests |
| `RUNNER_DATA_FILE` | Local crash-safe journal path for the testnet MVP |
| `STELLAR_RPC_URL` | Optional RPC override; defaults to Stellar testnet |
| `PORT` | Local HTTP port; defaults to `8787` |

Example job body (amount fields are raw seven-decimal contract units):

```json
{
  "jobId": "invoice-2026-07-15-001",
  "recipient": "G...",
  "asset": "C...",
  "totalAmount": "250000000",
  "ratePerSecond": "25000",
  "durationLedgers": 10000,
  "checkpointCount": 4,
  "withdrawableCapPercent": 60,
  "approvalTimeoutLedgers": 50,
  "title": "Agent research task"
}
```

## Operational response

### Suspected agent-key compromise

1. Pause the mandate immediately from the owner console.
2. Inspect recent Mandate and Stream events and the runner journal.
3. Replace the agent address with a newly secured signer if continued use is safe.
4. Revoke the mandate and recover its unused balance if trust cannot be restored.

### Runner crash or ambiguous submission

Restart with the same journal and job ID. The runner checks the on-chain request ID before submitting; the contract prevents the same request from producing a second stream. An `already_processed` job may require event lookup to recover its stream or proposal ID.

### RPC or submission failures

The runner retries a transaction three times with bounded backoff. Persistent failures are written as `failed`; do not blindly change the job ID because that defeats idempotency. Diagnose the contract error or RPC status first.

## Security boundary

- Never store an owner seed in the runner.
- Never place any secret in a `NEXT_PUBLIC_` variable, repository file, log, or client response.
- Begin with small caps, allowlisted recipients, and owner approval for all meaningful amounts.
- Use a database and secret manager before running more than one runner process.
- Profile worst-case Soroban resources and run Scout/static analysis before considering mainnet.
- Treat contract expiry as an authorization rule. Storage TTL is extended for liveness and is not a permission expiry.

## Verified checks

```text
cargo test                                 35 tests passed
cargo test -p agent_mandate_contract       10 tests passed
agent_mandate_contract release WASM        built successfully
npm run typecheck                          passed (web + runner)
npm run build                              passed
runner GET /health                         returned testnet healthy
```
