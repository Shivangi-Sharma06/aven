# Agent Payment Automation — Implementation Plan

## Implementation status — 2026-07-15

Completed for the testnet MVP:

- Agent Mandate interface, policy invariants, typed errors, events, TTL handling, and authorization design
- Real Mandate → Stream → SAC integration with atomic rollback and request idempotency tests
- Optimized release WASM and generated TypeScript binding
- Typed application client with readable contract errors
- HMAC-authenticated runner with bounded retries and a crash-safe single-process journal
- Two-tab `/agents` surface with owner controls and the existing reputation lookup
- Build, type, contract, and runner health validation

Intentionally deferred until a manually deployed mandate completes an end-to-end testnet rehearsal:

- Mandate factory and address index
- Production database/event indexer and multi-process runner operation
- Mainnet deployment, formal security review, resource profiling, and x402/MPP payment rails

## Objective

Add policy-controlled automated payment streams for AI agents while keeping Aven's existing Stream, Attestation, and Reputation contracts as the shared work protocol for both people and agents.

The implementation must support two distinct cases:

1. **Paying an agent for work** — already supported. An agent is simply the stream recipient and signs checkpoint submissions and withdrawals with its Stellar address.
2. **Allowing an agent to spend an owner's funds** — requires the new automation system described below.

The first release should target Stellar testnet and the repository's current protocol 26 / `soroban-sdk` 26.1 stack.

## Core design decision

Create one **Agent Mandate contract instance per owner-agent relationship**.

The mandate contract holds only the budget delegated to that agent. It becomes the sender recorded by the Stream contract and is the only component allowed to create or approve streams from that delegated budget. The human owner retains the ability to pause, revoke, reconfigure, and recover unused funds.

This is safer than keeping an owner's secret key in an automation service, and it avoids pretending that a contract can sign as a normal `G...` account.

```text
Owner wallet
  │ configures policy + deposits a limited budget
  ▼
Agent Mandate contract
  │ validates agent, recipient, asset, amount, duration, limits, and expiry
  ▼
Existing Stream contract
  │ checkpoints and settlement
  ├── Existing Attestation contract
  └── Existing Reputation contract

Agent runner
  ├── proposes or executes permitted streams
  ├── submits checkpoint evidence
  └── monitors events and retries safely
```

## Non-goals for the first release

- Replacing the existing Stream contract with an agent-specific stream contract
- Storing owner or agent secret keys in the browser, repository, or database
- Mainnet deployment
- Arbitrary token support; start with the existing allowlisted testnet USDC and XLM SAC addresses
- x402 or MPP integration; those solve per-request API payments and can be added later alongside Aven streams
- Fully autonomous approval for high-value payments

## Phase 1 — Contract specification and threat model

Before writing contract code, freeze the following policy semantics:

- One immutable `owner` and one replaceable or immutable `agent` per mandate
- Allowlisted Stream contract address and token addresses
- Per-stream amount cap
- Spend cap per ledger window, with an explicit window length
- Maximum stream duration and checkpoint count
- Optional recipient allowlist
- Mandate expiration ledger checked in contract logic
- Human-approval threshold
- Whether the agent may approve checkpoints for outgoing streams
- Emergency pause and permanent revoke behavior
- Rules for withdrawing unused mandate funds

Document the threat model:

- Compromised agent key
- Duplicate or replayed job requests
- Malicious recipient or token contract
- Automation runner retries and crashes
- Owner attempting to withdraw funds already transferred into a stream
- Expired or archived contract state
- Excessively large inputs or unbounded collections

### Deliverable

An agreed contract interface, invariant list, and error-code table before implementation begins.

## Phase 2 — Agent Mandate contract

Add a new workspace member:

```text
contracts/contracts/agent_mandate_contract/
  Cargo.toml
  src/lib.rs
  src/test.rs
```

### Suggested persistent types

```rust
MandateConfig {
    owner: Address,
    agent: Address,
    stream_contract: Address,
    per_stream_limit: i128,
    window_limit: i128,
    window_ledgers: u32,
    max_duration_ledgers: u32,
    max_checkpoint_count: u32,
    human_approval_threshold: i128,
    expires_at_ledger: u32,
    agent_can_approve_checkpoints: bool,
    paused: bool,
    revoked: bool,
}

SpendWindow {
    window_start: u32,
    spent: i128,
}

StreamProposal {
    id: u64,
    request_id: BytesN<32>,
    recipient: Address,
    asset: Address,
    total_deposited: i128,
    rate_per_second: i128,
    duration_ledgers: u32,
    checkpoint_count: u32,
    withdrawable_cap_percent: u32,
    approval_timeout_ledgers: u32,
    category: Category,
    title: String,
    status: ProposalStatus,
}
```

Use instance storage only for small global configuration and counters. Store proposals, request IDs, recipient permissions, and spend-window state as fine-grained persistent entries with explicit TTL extension.

### Suggested entry points

```text
__constructor(owner, agent, stream_contract, allowed_assets, policy)
deposit(owner, asset, amount)
withdraw_unused(owner, asset, amount, destination)
update_policy(owner, policy)
set_recipient(owner, recipient, allowed)
pause(owner)
resume(owner)
revoke(owner)
propose_stream(agent, request_id, stream_params) -> proposal_id
execute_stream(agent, request_id, stream_params) -> stream_id
approve_and_execute(owner, proposal_id) -> stream_id
reject_proposal(owner, proposal_id)
approve_checkpoint(agent_or_owner, stream_id, checkpoint_index)
get_config()
get_proposal(proposal_id)
get_spend_window()
is_request_used(request_id)
```

### Execution rules

- `execute_stream` is allowed only below the human-approval threshold.
- Higher-value requests must be stored with `propose_stream` and executed later by `approve_and_execute` with owner authorization.
- Each `request_id` can be consumed once. This provides contract-level idempotency for worker retries.
- Validate policy and update spend accounting in the same transaction that calls `StreamContract.create_stream`; a failure must roll everything back atomically.
- Pass `env.current_contract_address()` as the Stream sender. The mandate contract must authorize the exact nested Stream and token calls as the current contract.
- Never accept a caller-supplied Stream contract address during execution. Load the allowlisted deployment from contract state.
- Reject zero or negative amounts, expired mandates, invalid checkpoints, disallowed tokens, disallowed recipients, excessive durations, and arithmetic overflow.
- Store an explicit expiry ledger. Do not use storage TTL as an authorization expiry mechanism.

### Events

Emit typed events for:

- Mandate funded
- Policy updated
- Recipient allowed or removed
- Stream proposed
- Proposal approved or rejected
- Stream executed
- Checkpoint approved by mandate
- Mandate paused, resumed, or revoked
- Unused funds withdrawn

Use owner, agent, proposal ID, and stream ID as indexed topics where appropriate.

## Phase 3 — Factory and deployment workflow

Add an Agent Mandate Factory after the instance contract is stable.

Responsibilities:

- Deploy mandate instances with deterministic salts
- Record the mandate address for each owner-agent pair
- Prevent accidental duplicate deployments
- Emit a `mandate_deployed` event for indexing
- Keep the mandate WASM hash and allowed Stream deployment under admin control

The factory must not custody agent budgets or contain per-agent policy state.

Add repeatable scripts for:

- Local deployment
- Testnet deployment
- Stream/Attestation/Reputation/Mandate wiring
- Binding generation
- Deployment-address verification

## Phase 4 — TypeScript bindings and client layer

Generate and commit the mandate binding under:

```text
contracts/bindings/agent_mandate/
```

Extend `lib/contracts.ts` with:

- Mandate and factory contract IDs
- Known-network validation
- `getAgentMandateClient`
- `getAgentMandateFactoryClient`

Add a dedicated module such as `lib/agent-automation.ts` rather than expanding `lib/stellar.ts` indefinitely.

It should expose typed operations for:

- Deploying or locating a mandate
- Depositing and recovering funds
- Reading and updating policy
- Proposing, approving, rejecting, and executing streams
- Reading proposal and spend status
- Approving checkpoints through a mandate

Every transaction must be simulated before signing, use the correct network passphrase, and surface typed contract errors as human-readable messages.

## Phase 5 — Automation runner

Add a separate Node service rather than relying on a browser tab or Next.js serverless request to remain alive:

```text
services/agent-runner/
  src/index.ts
  src/policy.ts
  src/stellar.ts
  src/events.ts
  src/jobs.ts
```

### Runner responsibilities

- Receive authenticated job instructions from an agent
- Convert a canonical job ID into the on-chain `request_id`
- Fetch the current on-chain mandate policy before execution
- Reject locally if the request violates policy, while treating the contract as final authority
- Submit transactions with bounded retries
- Monitor Stream and Mandate events
- Submit checkpoint evidence hashes
- Route high-value proposals to the owner UI
- Resume incomplete jobs after restart

### Persistence

Use a durable database in production. Store:

- Job ID and request ID
- Mandate address
- Requested stream parameters
- Transaction hashes
- Proposal and stream IDs
- Current state and retry count
- Last processed event cursor or ledger
- Failure reason

Use a unique constraint on `(mandate_address, request_id)` to complement contract-level idempotency.

### Signing

- The owner continues to use Freighter for owner-only actions.
- The agent runner uses an agent-specific signer stored in a secret manager or KMS-backed service.
- Never use `NEXT_PUBLIC_` variables for secrets.
- Never log secret keys, signed envelopes, or raw authorization material.
- Add key rotation and immediate mandate revocation procedures.

## Phase 6 — Product UI

Turn `/agents` into a two-tab agent console while preserving the existing reputation lookup:

### Automation tab

- Create or connect an agent mandate
- Display owner, agent, mandate address, network, and status
- Deposit a limited USDC/XLM budget
- Configure per-stream cap, rolling-window cap, duration, checkpoints, expiry, and approval threshold
- Manage allowed recipients
- Pause, resume, or revoke the mandate
- Show remaining contract balance and current-window spend
- List pending proposals with approve/reject actions
- Show executed streams and their transaction hashes

### Reputation tab

- Preserve the current address lookup and score breakdown
- Link completed agent streams and attestations to the agent's public profile

### Stream views

- Mark streams whose sender is an Agent Mandate contract
- Display the controlling owner and agent where available
- Show whether a checkpoint was agent-approved, owner-approved, or auto-approved by timeout

High-value approvals must show recipient, amount, asset, duration, checkpoint policy, and projected total before Freighter signs.

## Phase 7 — Testing strategy

### Contract unit tests

Cover every public entry point and typed error path, including:

- Only owner can configure, pause, revoke, or withdraw
- Only registered agent can execute below-threshold streams
- Owner authorization is required above threshold
- Expired, paused, and revoked mandates cannot spend
- Per-stream and rolling-window limits cannot be bypassed
- Disallowed token and recipient rejection
- Duplicate `request_id` rejection
- Arithmetic overflow and zero/negative amount rejection
- Exact authorization trees for mandate → Stream → token calls
- Failed nested calls roll back spend accounting and request consumption
- Checkpoint approval permissions
- TTL extension on active persistent entries
- Exact event payloads

### Invariants and property tests

- Recorded spend never exceeds the configured window cap
- A request ID produces at most one stream
- Revocation can never be reversed by the agent
- Only deposited mandate funds can enter streams
- Owner recovery plus executed deposits never exceeds total mandate funding

### Integration tests

- Deploy all contracts on a local Stellar network
- Fund a mandate with test USDC
- Execute an agent-created stream
- Submit and approve checkpoints
- Withdraw earnings as the recipient
- Verify the resulting attestation and reputation score
- Exercise runner restart and duplicate-delivery behavior

### Security and release checks

- `cargo test`
- Optimized WASM build and size check
- `npm run typecheck`
- `npm run build`
- Static contract analysis with Scout
- Resource simulation for the worst-case policy and proposal calls
- Testnet rehearsal before any mainnet discussion

## Phase 8 — Rollout

1. Deploy on a local Stellar network with one owner and one agent.
2. Deploy to testnet behind an application feature flag.
3. Begin with assisted mode: every proposal requires owner approval.
4. Enable policy-controlled execution only for small limits and allowlisted recipients.
5. Add monitoring for mandate funding, unusual spend, repeated failures, and revocation.
6. Run a security review before accepting real funds.

## Acceptance criteria

The feature is complete when:

- An owner can create and fund a mandate without exposing a secret key.
- An agent can create a permitted stream without an owner signing every low-value transaction.
- The contract blocks requests that violate amount, recipient, asset, duration, expiry, or spend-window policy.
- High-value streams remain pending until the owner approves them.
- Duplicate runner deliveries cannot create duplicate streams.
- The owner can pause or permanently revoke automation and recover unused funds.
- Agent-created work produces the same checkpoints, attestations, and reputation as human-created work.
- All contract, integration, type, and production-build checks pass.

## Recommended implementation order

1. Freeze the mandate interface and threat model.
2. Implement and exhaustively test the mandate instance contract.
3. Prove the nested authorization path against the existing Stream contract.
4. Add generated bindings and the typed client layer.
5. Add the agent runner with durable idempotency.
6. Build the owner/agent UI.
7. Add the factory only after one manually deployed mandate works end to end.
8. Rehearse on testnet, profile resources, and conduct security review.

The most important technical spike is step 3. Before investing in the UI or runner, prove that a mandate contract can fund and authorize the complete `AgentMandate -> StreamContract -> SAC transfer` call tree on the repository's current protocol 26 stack.
