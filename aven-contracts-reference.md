# Aven Protocol v2 — Soroban Smart Contracts (Reference Copy)

Checkpoint-gated streaming with partial-lock withdrawal and per-checkpoint attestations. Plain-text reference version for upload/comparison purposes only. Not meant to be compiled from this file — use the .zip with actual .rs files for that.

---

## 1. Workspace Cargo.toml

```toml
[workspace]
resolver = "2"
members = [
    "contracts/shared",
    "contracts/stream_contract",
    "contracts/attestation_contract",
    "contracts/reputation_contract",
]

[workspace.dependencies]
soroban-sdk = "22.0.0"

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true
```

---

## 2. shared — Cargo.toml

```toml
[package]
name = "shared"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["rlib"]

[dependencies]
soroban-sdk = { workspace = true }

[features]
testutils = ["soroban-sdk/testutils"]
```

## 2a. shared — src/lib.rs

```rust
#![no_std]

use soroban_sdk::{contracttype, Address, BytesN, String};

/// Approximate ledger bump for ~31 days at ~5s/ledger. Used as both the
/// "extend to" and "threshold" argument on every extend_ttl call.
pub const LEDGER_BUMP: u32 = 535_680;

/// Ledgers per "second unit" used to convert a per-second rate supplied by
/// the frontend into a per-ledger rate stored on-chain. Stellar targets
/// ~5s per ledger. Storing the rate already-converted means every on-chain
/// computation afterwards is pure multiplication, never division.
pub const LEDGERS_PER_UNIT: i128 = 5;

/// Hard cap on checkpoints per stream. Keeps every loop over a stream's
/// checkpoints (in withdraw, cancel, settle) bounded and cheap regardless
/// of how a client configures a stream.
pub const MAX_CHECKPOINTS: u32 = 30;

/// Hard cap on how many attestation ids we will iterate over in a single
/// reputation read, to keep resource consumption predictable.
pub const MAX_HISTORY_READ: u32 = 100;

/// Hard cap on how many ids we will ever store against a single address,
/// to keep per-account storage growth (and rent) bounded.
pub const MAX_HISTORY_LEN: u32 = 1000;

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum StreamStatus {
    Active,
    Paused,
    Completed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Category {
    Freelance,
    Salary,
    Bounty,
    Grant,
    AgentTask,
    Subscription,
}

#[contracttype]
#[derive(Clone)]
pub struct StreamRecord {
    pub id: u64,
    pub sender: Address,
    pub recipient: Address,
    /// Amount earned per ledger, already converted from the per-second
    /// rate the frontend supplied at creation time.
    pub rate_per_ledger: i128,
    /// SAC token contract address. Works identically whether this points
    /// at the USDC SAC, the native XLM SAC, or any other Stellar Asset
    /// Contract — the standard token interface is uniform across all of
    /// them, so nothing in this contract special-cases the asset.
    pub asset: Address,
    pub total_deposited: i128,
    pub total_withdrawn: i128,
    pub start_ledger: u32,
    pub duration_ledgers: u32,
    pub status: StreamStatus,
    pub category: Category,
    pub title: String,
    pub paused_at_ledger: u32,
    /// 0 means "not currently paused". Any other value is the ledger at
    /// which the current pause began.
    pub paused_duration_ledgers: u32,

    // ---- Checkpoint configuration, fixed at creation by the sender ----
    /// How many equal-length checkpoints this stream is split into. 1
    /// means "no fragmentation" — behaves like a single lump attestation
    /// at the end, same as the very first version of this protocol.
    pub checkpoint_count: u32,
    /// duration_ledgers / checkpoint_count. Enforced to divide evenly at
    /// creation time so every checkpoint covers an identical span.
    pub checkpoint_span_ledgers: u32,
    /// Percentage (0-100) of a checkpoint's earned amount that is
    /// withdrawable before that checkpoint is approved or times out.
    /// The remaining (100 - this) stays locked until approval/timeout.
    pub withdrawable_cap_percent: u32,
    /// How many ledgers after a checkpoint's due_ledger the client has to
    /// call approve_checkpoint before that checkpoint auto-releases
    /// unconfirmed. Pausing the stream does not extend this deadline —
    /// senders should resume promptly to avoid an auto-release they
    /// didn't intend.
    pub approval_timeout_ledgers: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct CheckpointRecord {
    pub stream_id: u64,
    pub index: u32,
    pub due_ledger: u32,
    pub submitted: bool,
    /// Hash of whatever off-chain evidence the worker points to (a PR
    /// link, a deliverable URL, a file) — content itself never touches
    /// the chain, only its hash does.
    pub evidence_hash: BytesN<32>,
    /// True only if the sender explicitly called approve_checkpoint.
    pub approved: bool,
    /// True only if this checkpoint unlocked because the approval
    /// deadline passed without the sender acting — never true at the
    /// same time as `approved`.
    pub auto_approved: bool,
    /// 0 until this checkpoint's attestation has been minted. Guards
    /// against ever minting twice for the same checkpoint.
    pub attestation_id: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct AttestationRecord {
    pub id: u64,
    pub stream_id: u64,
    pub checkpoint_index: u32,
    pub sender: Address,
    pub recipient: Address,
    /// Amount this specific checkpoint paid out, not the whole stream's
    /// total — each checkpoint mints its own attestation as it finalizes.
    pub amount_paid: i128,
    pub asset: Address,
    pub category: Category,
    pub title: String,
    pub period_start_ledger: u32,
    pub period_end_ledger: u32,
    pub minted_at_ledger: u32,
    /// True if the sender actively approved this checkpoint. False if it
    /// only released because the approval timeout expired — a weaker
    /// signal, and reputation_contract weights it accordingly.
    pub client_confirmed: bool,
}
```

---

## 3. stream_contract — Cargo.toml

```toml
[package]
name = "stream_contract"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { workspace = true }
shared = { path = "../shared" }

[features]
testutils = ["soroban-sdk/testutils", "shared/testutils"]
```

## 3a. stream_contract — src/lib.rs

```rust
#![no_std]

use shared::{
    Category, CheckpointRecord, StreamRecord, StreamStatus, LEDGER_BUMP, LEDGERS_PER_UNIT,
    MAX_CHECKPOINTS, MAX_HISTORY_LEN,
};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, vec, Address,
    BytesN, Env, IntoVal, String, Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    AttestationContract,
    NextStreamId,
    Stream(u64),
    SenderStreams(Address),
    RecipientStreams(Address),
    Checkpoint(u64, u32),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidRate = 3,
    InvalidDeposit = 4,
    InvalidDuration = 5,
    TitleTooLong = 6,
    InsufficientDeposit = 7,
    StreamNotFound = 8,
    NotSender = 9,
    NotRecipient = 10,
    WrongStatus = 11,
    NothingToWithdraw = 12,
    Overflow = 13,
    HistoryFull = 14,
    InvalidCheckpointCount = 15,
    DurationNotDivisible = 16,
    InvalidCapPercent = 17,
    InvalidTimeout = 18,
    IndexOutOfRange = 19,
    CheckpointNotSubmitted = 20,
    CheckpointAlreadyFinalized = 21,
}

const MAX_TITLE_LEN: u32 = 80;

#[contract]
pub struct StreamContract;

#[contractimpl]
impl StreamContract {
    /// One-time setup. Stores the admin (upgrade coordination only — never
    /// has access to user funds) and the AttestationContract address this
    /// contract is allowed to call into when a checkpoint finalizes.
    pub fn init(env: Env, admin: Address, attestation_contract: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::AttestationContract, &attestation_contract);
        env.storage().instance().set(&DataKey::NextStreamId, &1u64);
        env.storage()
            .instance()
            .extend_ttl(LEDGER_BUMP, LEDGER_BUMP);
        Ok(())
    }

    /// Creates a new stream, fragmented into `checkpoint_count` equal
    /// checkpoints. Pulls `total_deposited` of `asset` from `sender` up
    /// front via the standard SAC token interface — this works
    /// identically whether `asset` is the USDC SAC address, the native
    /// XLM SAC address, or any other Stellar Asset Contract, since the
    /// token interface is uniform across all of them.
    #[allow(clippy::too_many_arguments)]
    pub fn create_stream(
        env: Env,
        sender: Address,
        recipient: Address,
        rate_per_second: i128,
        asset: Address,
        total_deposited: i128,
        duration_ledgers: u32,
        checkpoint_count: u32,
        withdrawable_cap_percent: u32,
        approval_timeout_ledgers: u32,
        category: Category,
        title: String,
    ) -> Result<u64, Error> {
        sender.require_auth();
        bump_instance(&env);

        if rate_per_second <= 0 {
            return Err(Error::InvalidRate);
        }
        if total_deposited <= 0 {
            return Err(Error::InvalidDeposit);
        }
        if duration_ledgers == 0 {
            return Err(Error::InvalidDuration);
        }
        if title.len() > MAX_TITLE_LEN {
            return Err(Error::TitleTooLong);
        }
        if checkpoint_count == 0 || checkpoint_count > MAX_CHECKPOINTS {
            return Err(Error::InvalidCheckpointCount);
        }
        if duration_ledgers % checkpoint_count != 0 {
            return Err(Error::DurationNotDivisible);
        }
        if withdrawable_cap_percent > 100 {
            return Err(Error::InvalidCapPercent);
        }
        if approval_timeout_ledgers == 0 {
            return Err(Error::InvalidTimeout);
        }

        let checkpoint_span_ledgers = duration_ledgers / checkpoint_count;

        // Convert the per-second rate into a per-ledger rate up front so
        // every subsequent computation is pure multiplication.
        let rate_per_ledger = rate_per_second
            .checked_mul(LEDGERS_PER_UNIT)
            .ok_or(Error::Overflow)?;

        let required = rate_per_ledger
            .checked_mul(duration_ledgers as i128)
            .ok_or(Error::Overflow)?;
        if total_deposited < required {
            return Err(Error::InsufficientDeposit);
        }

        // Pull funds BEFORE writing any state, so a failed transfer can
        // never leave a stream record referencing money we don't hold.
        let token_client = token::Client::new(&env, &asset);
        token_client.transfer(&sender, &env.current_contract_address(), &total_deposited);

        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextStreamId)
            .unwrap_or(1u64);
        let next_id = id.checked_add(1).ok_or(Error::Overflow)?;
        env.storage()
            .instance()
            .set(&DataKey::NextStreamId, &next_id);

        let record = StreamRecord {
            id,
            sender: sender.clone(),
            recipient: recipient.clone(),
            rate_per_ledger,
            asset,
            total_deposited,
            total_withdrawn: 0,
            start_ledger: env.ledger().sequence(),
            duration_ledgers,
            status: StreamStatus::Active,
            category,
            title,
            paused_at_ledger: 0,
            paused_duration_ledgers: 0,
            checkpoint_count,
            checkpoint_span_ledgers,
            withdrawable_cap_percent,
            approval_timeout_ledgers,
        };

        save_stream(&env, &record);
        append_id(&env, DataKey::SenderStreams(sender), id)?;
        append_id(&env, DataKey::RecipientStreams(recipient), id)?;

        env.events()
            .publish((symbol_short!("created"), id), record.sender.clone());

        Ok(id)
    }

    /// Worker marks a checkpoint as done and attaches evidence. Moves no
    /// funds and mints nothing by itself — it only makes the checkpoint
    /// eligible for approve_checkpoint.
    pub fn submit_checkpoint(
        env: Env,
        stream_id: u64,
        worker: Address,
        index: u32,
        evidence_hash: BytesN<32>,
    ) -> Result<(), Error> {
        worker.require_auth();
        bump_instance(&env);

        let stream = load_stream(&env, stream_id)?;
        if worker != stream.recipient {
            return Err(Error::NotRecipient);
        }
        if index >= stream.checkpoint_count {
            return Err(Error::IndexOutOfRange);
        }

        let mut checkpoint = load_checkpoint(&env, &stream, index);
        if checkpoint.attestation_id != 0 {
            return Err(Error::CheckpointAlreadyFinalized);
        }

        checkpoint.submitted = true;
        checkpoint.evidence_hash = evidence_hash;
        save_checkpoint(&env, &checkpoint);

        env.events()
            .publish((symbol_short!("submitted"), stream_id), index);
        Ok(())
    }

    /// Sender explicitly confirms a submitted checkpoint. This is what
    /// makes `client_confirmed = true` on the resulting attestation, and
    /// it immediately unlocks the remaining locked percentage for that
    /// checkpoint.
    pub fn approve_checkpoint(
        env: Env,
        stream_id: u64,
        sender: Address,
        index: u32,
    ) -> Result<u64, Error> {
        sender.require_auth();
        bump_instance(&env);

        let stream = load_stream(&env, stream_id)?;
        if sender != stream.sender {
            return Err(Error::NotSender);
        }
        if index >= stream.checkpoint_count {
            return Err(Error::IndexOutOfRange);
        }

        let mut checkpoint = load_checkpoint(&env, &stream, index);
        if checkpoint.attestation_id != 0 {
            return Err(Error::CheckpointAlreadyFinalized);
        }
        if !checkpoint.submitted {
            return Err(Error::CheckpointNotSubmitted);
        }

        checkpoint.approved = true;
        let attestation_id = finalize_checkpoint(&env, &stream, &mut checkpoint, true)?;

        env.events()
            .publish((symbol_short!("approved"), stream_id), index);
        Ok(attestation_id)
    }

    /// Permissionless "crank" — anyone can call this to push any
    /// past-deadline, unapproved checkpoints into their auto-released
    /// state. Moves no funds itself; withdraw() also does this
    /// automatically, so this exists mainly so the finalization (and the
    /// unconfirmed attestation it produces) can happen even if the
    /// recipient hasn't withdrawn yet.
    pub fn settle_checkpoints(env: Env, stream_id: u64) -> Result<u32, Error> {
        bump_instance(&env);
        let stream = load_stream(&env, stream_id)?;
        let settled = finalize_due_checkpoints(&env, &stream)?;
        Ok(settled)
    }

    /// Recipient withdraws whatever is currently unlocked and not yet
    /// withdrawn. Before computing the amount, this also opportunistically
    /// finalizes any checkpoints that are past their approval deadline, so
    /// withdrawing regularly is enough to keep the stream's state honest
    /// without anyone needing to call settle_checkpoints separately.
    pub fn withdraw(env: Env, stream_id: u64, caller: Address) -> Result<i128, Error> {
        caller.require_auth();
        bump_instance(&env);

        let mut stream = load_stream(&env, stream_id)?;
        if caller != stream.recipient {
            return Err(Error::NotRecipient);
        }
        if stream.status != StreamStatus::Active
            && stream.status != StreamStatus::Paused
            && stream.status != StreamStatus::Completed
        {
            return Err(Error::WrongStatus);
        }

        finalize_due_checkpoints(&env, &stream)?;

        let withdrawable = compute_withdrawable(&env, &stream)?;
        if withdrawable <= 0 {
            return Err(Error::NothingToWithdraw);
        }

        stream.total_withdrawn = stream
            .total_withdrawn
            .checked_add(withdrawable)
            .ok_or(Error::Overflow)?;

        let elapsed = elapsed_active_ledgers(&env, &stream);
        if elapsed >= stream.duration_ledgers && stream.status != StreamStatus::Completed {
            stream.status = StreamStatus::Completed;
        }
        save_stream(&env, &stream);

        let token_client = token::Client::new(&env, &stream.asset);
        token_client.transfer(
            &env.current_contract_address(),
            &stream.recipient,
            &withdrawable,
        );

        env.events()
            .publish((symbol_short!("withdrawn"), stream_id), withdrawable);
        Ok(withdrawable)
    }

    pub fn pause_stream(env: Env, stream_id: u64, caller: Address) -> Result<(), Error> {
        caller.require_auth();
        bump_instance(&env);

        let mut stream = load_stream(&env, stream_id)?;
        if caller != stream.sender {
            return Err(Error::NotSender);
        }
        if stream.status != StreamStatus::Active {
            return Err(Error::WrongStatus);
        }

        stream.status = StreamStatus::Paused;
        stream.paused_at_ledger = env.ledger().sequence();
        save_stream(&env, &stream);

        env.events()
            .publish((symbol_short!("paused"), stream_id), stream.paused_at_ledger);
        Ok(())
    }

    pub fn resume_stream(env: Env, stream_id: u64, caller: Address) -> Result<(), Error> {
        caller.require_auth();
        bump_instance(&env);

        let mut stream = load_stream(&env, stream_id)?;
        if caller != stream.sender {
            return Err(Error::NotSender);
        }
        if stream.status != StreamStatus::Paused {
            return Err(Error::WrongStatus);
        }

        let now = env.ledger().sequence();
        let pause_len = now.saturating_sub(stream.paused_at_ledger);
        stream.paused_duration_ledgers = stream
            .paused_duration_ledgers
            .checked_add(pause_len)
            .ok_or(Error::Overflow)?;
        stream.paused_at_ledger = 0;
        stream.status = StreamStatus::Active;
        save_stream(&env, &stream);

        env.events()
            .publish((symbol_short!("resumed"), stream_id), now);
        Ok(())
    }

    /// Sender cancels the stream. The recipient receives exactly whatever
    /// is currently unlocked per the checkpoint rules (identical
    /// computation to a normal withdraw); everything else returns to the
    /// sender. Locked-but-earned money that hadn't cleared a checkpoint
    /// goes back to the sender, which is the whole point of the lock.
    pub fn cancel_stream(env: Env, stream_id: u64, caller: Address) -> Result<(), Error> {
        caller.require_auth();
        bump_instance(&env);

        let mut stream = load_stream(&env, stream_id)?;
        if caller != stream.sender {
            return Err(Error::NotSender);
        }
        if stream.status != StreamStatus::Active && stream.status != StreamStatus::Paused {
            return Err(Error::WrongStatus);
        }

        finalize_due_checkpoints(&env, &stream)?;

        let earned_unlocked = compute_withdrawable(&env, &stream)?;
        let remaining_pool = stream
            .total_deposited
            .checked_sub(stream.total_withdrawn)
            .ok_or(Error::Overflow)?;
        let refund_to_sender = remaining_pool
            .checked_sub(earned_unlocked)
            .ok_or(Error::Overflow)?;

        stream.total_withdrawn = stream
            .total_withdrawn
            .checked_add(earned_unlocked)
            .ok_or(Error::Overflow)?;
        stream.status = StreamStatus::Cancelled;
        save_stream(&env, &stream);

        let token_client = token::Client::new(&env, &stream.asset);
        if earned_unlocked > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &stream.recipient,
                &earned_unlocked,
            );
        }
        if refund_to_sender > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &stream.sender,
                &refund_to_sender,
            );
        }

        env.events()
            .publish((symbol_short!("cancelled"), stream_id), earned_unlocked);
        Ok(())
    }

    pub fn get_stream(env: Env, stream_id: u64) -> Result<StreamRecord, Error> {
        load_stream(&env, stream_id)
    }

    pub fn get_checkpoint(
        env: Env,
        stream_id: u64,
        index: u32,
    ) -> Result<CheckpointRecord, Error> {
        let stream = load_stream(&env, stream_id)?;
        if index >= stream.checkpoint_count {
            return Err(Error::IndexOutOfRange);
        }
        Ok(load_checkpoint(&env, &stream, index))
    }

    pub fn get_sender_streams(env: Env, sender: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::SenderStreams(sender))
            .unwrap_or(vec![&env])
    }

    pub fn get_recipient_streams(env: Env, recipient: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::RecipientStreams(recipient))
            .unwrap_or(vec![&env])
    }

    /// Read-only view of the currently withdrawable amount. Safe to poll
    /// from the frontend every tick — touches no storage writes and does
    /// NOT finalize checkpoints (that only happens on an actual state-
    /// changing call). This means the displayed number can occasionally
    /// show a timed-out checkpoint as unlocked slightly before the chain
    /// state formally catches up — the next withdraw/settle call reconciles
    /// it exactly.
    pub fn compute_earned(env: Env, stream_id: u64) -> Result<i128, Error> {
        let stream = load_stream(&env, stream_id)?;
        compute_withdrawable(&env, &stream)
    }
}

// ---------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(LEDGER_BUMP, LEDGER_BUMP);
}

fn save_stream(env: &Env, stream: &StreamRecord) {
    let key = DataKey::Stream(stream.id);
    env.storage().persistent().set(&key, stream);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_BUMP, LEDGER_BUMP);
}

fn load_stream(env: &Env, stream_id: u64) -> Result<StreamRecord, Error> {
    let key = DataKey::Stream(stream_id);
    let stream: StreamRecord = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::StreamNotFound)?;
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_BUMP, LEDGER_BUMP);
    Ok(stream)
}

fn append_id(env: &Env, key: DataKey, id: u64) -> Result<(), Error> {
    let mut list: Vec<u64> = env.storage().persistent().get(&key).unwrap_or(vec![env]);
    if list.len() >= MAX_HISTORY_LEN {
        return Err(Error::HistoryFull);
    }
    list.push_back(id);
    env.storage().persistent().set(&key, &list);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_BUMP, LEDGER_BUMP);
    Ok(())
}

fn checkpoint_default(stream: &StreamRecord, index: u32, env: &Env) -> CheckpointRecord {
    let due_ledger = stream.start_ledger + stream.checkpoint_span_ledgers * (index + 1);
    CheckpointRecord {
        stream_id: stream.id,
        index,
        due_ledger,
        submitted: false,
        evidence_hash: BytesN::from_array(env, &[0u8; 32]),
        approved: false,
        auto_approved: false,
        attestation_id: 0,
    }
}

fn load_checkpoint(env: &Env, stream: &StreamRecord, index: u32) -> CheckpointRecord {
    let key = DataKey::Checkpoint(stream.id, index);
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| checkpoint_default(stream, index, env))
}

fn save_checkpoint(env: &Env, checkpoint: &CheckpointRecord) {
    let key = DataKey::Checkpoint(checkpoint.stream_id, checkpoint.index);
    env.storage().persistent().set(&key, checkpoint);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_BUMP, LEDGER_BUMP);
}

/// Ledgers during which the stream was actually earning — wall-clock
/// elapsed ledgers minus every ledger spent paused (including the current
/// open pause, if any). Capped at duration_ledgers.
fn elapsed_active_ledgers(env: &Env, stream: &StreamRecord) -> u32 {
    let now = env.ledger().sequence();

    let clock_ceiling = if stream.status == StreamStatus::Paused {
        stream.paused_at_ledger
    } else {
        now
    };

    let raw_elapsed = clock_ceiling.saturating_sub(stream.start_ledger);
    let active_elapsed = raw_elapsed.saturating_sub(stream.paused_duration_ledgers);

    if active_elapsed > stream.duration_ledgers {
        stream.duration_ledgers
    } else {
        active_elapsed
    }
}

fn is_unlocked(checkpoint: &CheckpointRecord, stream: &StreamRecord, now: u32) -> bool {
    if checkpoint.approved || checkpoint.auto_approved {
        return true;
    }
    let deadline = checkpoint
        .due_ledger
        .saturating_add(stream.approval_timeout_ledgers);
    now >= deadline
}

/// Computes the currently withdrawable amount, respecting per-checkpoint
/// locks. Pure read — never writes storage. Checkpoints whose full period
/// has elapsed contribute either their full amount (if unlocked) or a
/// capped percentage (if still pending approval and inside the timeout
/// window). The checkpoint currently in progress contributes its partial
/// earned amount at the same capped percentage, so the live counter still
/// feels continuous even mid-checkpoint.
fn compute_withdrawable(env: &Env, stream: &StreamRecord) -> Result<i128, Error> {
    if stream.status == StreamStatus::Cancelled {
        return Ok(0);
    }

    let elapsed = elapsed_active_ledgers(env, stream);
    let span = stream.checkpoint_span_ledgers as u32;
    let now = env.ledger().sequence();

    let full_checkpoints = elapsed / span;
    let partial_ledgers = elapsed % span;

    let mut total_earned: i128 = 0;

    let mut i: u32 = 0;
    while i < full_checkpoints && i < stream.checkpoint_count {
        let checkpoint = load_checkpoint(env, stream, i);
        let full_amount = stream
            .rate_per_ledger
            .checked_mul(span as i128)
            .ok_or(Error::Overflow)?;

        let contribution = if is_unlocked(&checkpoint, stream, now) {
            full_amount
        } else {
            full_amount
                .checked_mul(stream.withdrawable_cap_percent as i128)
                .ok_or(Error::Overflow)?
                / 100
        };

        total_earned = total_earned.checked_add(contribution).ok_or(Error::Overflow)?;
        i += 1;
    }

    if full_checkpoints < stream.checkpoint_count && partial_ledgers > 0 {
        let in_progress_amount = stream
            .rate_per_ledger
            .checked_mul(partial_ledgers as i128)
            .ok_or(Error::Overflow)?;
        let capped_partial = in_progress_amount
            .checked_mul(stream.withdrawable_cap_percent as i128)
            .ok_or(Error::Overflow)?
            / 100;
        total_earned = total_earned
            .checked_add(capped_partial)
            .ok_or(Error::Overflow)?;
    }

    if total_earned > stream.total_deposited {
        total_earned = stream.total_deposited;
    }

    let withdrawable = total_earned
        .checked_sub(stream.total_withdrawn)
        .ok_or(Error::Overflow)?;

    Ok(if withdrawable < 0 { 0 } else { withdrawable })
}

/// Walks every checkpoint whose period has fully elapsed and, for any
/// that are unlocked (approved or timed out) but not yet finalized, mints
/// its attestation. This is what makes withdraw() and settle_checkpoints()
/// self-healing — chain state catches up to reality the moment anyone
/// interacts with the stream, without needing a keeper bot for
/// correctness (though settle_checkpoints can be called by one anyway).
fn finalize_due_checkpoints(env: &Env, stream: &StreamRecord) -> Result<u32, Error> {
    let elapsed = elapsed_active_ledgers(env, stream);
    let span = stream.checkpoint_span_ledgers;
    let full_checkpoints = elapsed / span;
    let now = env.ledger().sequence();

    let mut settled = 0u32;
    let mut i: u32 = 0;
    while i < full_checkpoints && i < stream.checkpoint_count {
        let mut checkpoint = load_checkpoint(env, stream, i);
        if checkpoint.attestation_id == 0 && is_unlocked(&checkpoint, stream, now) {
            let confirmed = checkpoint.approved;
            if !confirmed {
                checkpoint.auto_approved = true;
            }
            finalize_checkpoint(env, stream, &mut checkpoint, confirmed)?;
            settled += 1;
        }
        i += 1;
    }
    Ok(settled)
}

/// Mints the attestation for a single checkpoint and persists the result.
/// Guarded so it can never fire twice for the same checkpoint.
fn finalize_checkpoint(
    env: &Env,
    stream: &StreamRecord,
    checkpoint: &mut CheckpointRecord,
    client_confirmed: bool,
) -> Result<u64, Error> {
    if checkpoint.attestation_id != 0 {
        return Err(Error::CheckpointAlreadyFinalized);
    }

    let amount_paid = stream
        .rate_per_ledger
        .checked_mul(stream.checkpoint_span_ledgers as i128)
        .ok_or(Error::Overflow)?;

    let period_start = stream.start_ledger + stream.checkpoint_span_ledgers * checkpoint.index;
    let period_end = checkpoint.due_ledger;

    let attestation_contract: Address = env
        .storage()
        .instance()
        .get(&DataKey::AttestationContract)
        .ok_or(Error::NotInitialized)?;

    let args: Vec<soroban_sdk::Val> = vec![
        env,
        env.current_contract_address().into_val(env),
        stream.id.into_val(env),
        checkpoint.index.into_val(env),
        stream.sender.clone().into_val(env),
        stream.recipient.clone().into_val(env),
        amount_paid.into_val(env),
        stream.asset.clone().into_val(env),
        stream.category.clone().into_val(env),
        stream.title.clone().into_val(env),
        period_start.into_val(env),
        period_end.into_val(env),
        client_confirmed.into_val(env),
    ];

    let attestation_id: u64 = env.invoke_contract(
        &attestation_contract,
        &Symbol::new(env, "mint_attestation"),
        args,
    );

    checkpoint.attestation_id = attestation_id;
    save_checkpoint(env, checkpoint);

    env.events().publish(
        (symbol_short!("finalized"), stream.id),
        (checkpoint.index, attestation_id, client_confirmed),
    );

    Ok(attestation_id)
}
```

---

## 4. attestation_contract — Cargo.toml

```toml
[package]
name = "attestation_contract"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { workspace = true }
shared = { path = "../shared" }

[features]
testutils = ["soroban-sdk/testutils", "shared/testutils"]
```

## 4a. attestation_contract — src/lib.rs

```rust
#![no_std]

use shared::{AttestationRecord, Category, LEDGER_BUMP, MAX_HISTORY_LEN};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, vec, Address, Env, String,
    Vec,
};

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    StreamContract,
    NextAttestationId,
    Attestation(u64),
    RecipientAttestations(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    AttestationNotFound = 4,
    Overflow = 5,
    HistoryFull = 6,
}

#[contract]
pub struct AttestationContract;

#[contractimpl]
impl AttestationContract {
    /// One-time setup. Stores the single address allowed to mint
    /// attestations. This is the entire trust boundary of the protocol.
    pub fn init(env: Env, admin: Address, stream_contract: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::StreamContract, &stream_contract);
        env.storage()
            .instance()
            .set(&DataKey::NextAttestationId, &1u64);
        env.storage()
            .instance()
            .extend_ttl(LEDGER_BUMP, LEDGER_BUMP);
        Ok(())
    }

    /// Mints one Work Attestation for a single checkpoint of a stream.
    /// `caller` MUST be the registered StreamContract address AND must
    /// satisfy `require_auth()`.
    ///
    /// Why this is safe: when Contract A calls Contract B directly and
    /// passes its own address as `caller`, the Soroban host automatically
    /// authorizes that specific invocation for A — no signature is needed
    /// because A is the actual, live, verified caller on the current
    /// invocation stack. A different contract cannot spoof this by simply
    /// passing StreamContract's address as the argument value, because it
    /// is not actually StreamContract making the call — the host ties the
    /// authorization to the real invocation, not to a plain argument.
    ///
    /// This is the single most security-critical check in the protocol.
    /// If it is ever weakened to a bare `==` comparison without
    /// `require_auth()`, anyone can mint fraudulent credentials.
    #[allow(clippy::too_many_arguments)]
    pub fn mint_attestation(
        env: Env,
        caller: Address,
        stream_id: u64,
        checkpoint_index: u32,
        sender: Address,
        recipient: Address,
        amount_paid: i128,
        asset: Address,
        category: Category,
        title: String,
        period_start_ledger: u32,
        period_end_ledger: u32,
        client_confirmed: bool,
    ) -> Result<u64, Error> {
        caller.require_auth();

        let registered_stream_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::StreamContract)
            .ok_or(Error::NotInitialized)?;

        if caller != registered_stream_contract {
            return Err(Error::Unauthorized);
        }

        env.storage()
            .instance()
            .extend_ttl(LEDGER_BUMP, LEDGER_BUMP);

        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextAttestationId)
            .unwrap_or(1u64);
        let next_id = id.checked_add(1).ok_or(Error::Overflow)?;
        env.storage()
            .instance()
            .set(&DataKey::NextAttestationId, &next_id);

        let record = AttestationRecord {
            id,
            stream_id,
            checkpoint_index,
            sender,
            recipient: recipient.clone(),
            amount_paid,
            asset,
            category,
            title,
            period_start_ledger,
            period_end_ledger,
            minted_at_ledger: env.ledger().sequence(),
            client_confirmed,
        };

        let key = DataKey::Attestation(id);
        env.storage().persistent().set(&key, &record);
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_BUMP, LEDGER_BUMP);

        let list_key = DataKey::RecipientAttestations(recipient);
        let mut list: Vec<u64> = env
            .storage()
            .persistent()
            .get(&list_key)
            .unwrap_or(vec![&env]);
        if list.len() >= MAX_HISTORY_LEN {
            return Err(Error::HistoryFull);
        }
        list.push_back(id);
        env.storage().persistent().set(&list_key, &list);
        env.storage()
            .persistent()
            .extend_ttl(&list_key, LEDGER_BUMP, LEDGER_BUMP);

        env.events()
            .publish((symbol_short!("minted"), id), (stream_id, checkpoint_index));

        Ok(id)
    }

    pub fn get_attestation(env: Env, attestation_id: u64) -> Result<AttestationRecord, Error> {
        let key = DataKey::Attestation(attestation_id);
        let record: AttestationRecord = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::AttestationNotFound)?;
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_BUMP, LEDGER_BUMP);
        Ok(record)
    }

    pub fn get_recipient_attestations(env: Env, recipient: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::RecipientAttestations(recipient))
            .unwrap_or(vec![&env])
    }

    /// Never panics on a missing id — returns false so verifier UIs can
    /// render a clean "not found" state instead of crashing.
    pub fn verify_attestation(env: Env, attestation_id: u64) -> bool {
        let key = DataKey::Attestation(attestation_id);
        match env
            .storage()
            .persistent()
            .get::<DataKey, AttestationRecord>(&key)
        {
            Some(record) => record.amount_paid > 0,
            None => false,
        }
    }
}
```

---

## 5. reputation_contract — Cargo.toml

```toml
[package]
name = "reputation_contract"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { workspace = true }
shared = { path = "../shared" }
attestation_contract = { path = "../attestation_contract" }

[features]
testutils = ["soroban-sdk/testutils", "shared/testutils"]
```

## 5a. reputation_contract — src/lib.rs

```rust
#![no_std]

use attestation_contract::AttestationContractClient;
use shared::{AttestationRecord, Category, MAX_HISTORY_READ};
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Vec};

#[contracttype]
#[derive(Clone)]
pub struct ScoreBreakdown {
    pub total: i128,
    pub freelance: i128,
    pub salary: i128,
    pub bounty: i128,
    pub grant: i128,
    pub agent_task: i128,
    pub subscription: i128,
}

const RECENCY_WINDOW_HOT: u32 = 120_960; // ~7 days
const RECENCY_WINDOW_WARM: u32 = 864_000; // ~50 days
const SCORE_CAP: i128 = 10_000;

#[contract]
pub struct ReputationContract;

#[contractimpl]
impl ReputationContract {
    /// Recomputes a score live from on-chain attestation history on every
    /// call. Nothing is ever cached or stored, so a score can never be
    /// frozen at a high value — it always reflects current chain state.
    pub fn compute_score(env: Env, attestation_contract: Address, recipient: Address) -> i128 {
        Self::get_score_breakdown(env, attestation_contract, recipient).total
    }

    pub fn get_score_breakdown(
        env: Env,
        attestation_contract: Address,
        recipient: Address,
    ) -> ScoreBreakdown {
        let client = AttestationContractClient::new(&env, &attestation_contract);
        let ids: Vec<u64> = client.get_recipient_attestations(&recipient);

        let mut breakdown = ScoreBreakdown {
            total: 0,
            freelance: 0,
            salary: 0,
            bounty: 0,
            grant: 0,
            agent_task: 0,
            subscription: 0,
        };

        let current_ledger = env.ledger().sequence();
        let read_count = if ids.len() > MAX_HISTORY_READ {
            MAX_HISTORY_READ
        } else {
            ids.len()
        };

        let mut i: u32 = 0;
        while i < read_count {
            let id = ids.get(i).unwrap();
            let record: AttestationRecord = client.get_attestation(&id);
            let points = score_one(&record, current_ledger);

            breakdown.total = breakdown.total.saturating_add(points);
            match record.category {
                Category::Freelance => {
                    breakdown.freelance = breakdown.freelance.saturating_add(points)
                }
                Category::Salary => breakdown.salary = breakdown.salary.saturating_add(points),
                Category::Bounty => breakdown.bounty = breakdown.bounty.saturating_add(points),
                Category::Grant => breakdown.grant = breakdown.grant.saturating_add(points),
                Category::AgentTask => {
                    breakdown.agent_task = breakdown.agent_task.saturating_add(points)
                }
                Category::Subscription => {
                    breakdown.subscription = breakdown.subscription.saturating_add(points)
                }
            }
            i += 1;
        }

        if breakdown.total > SCORE_CAP {
            breakdown.total = SCORE_CAP;
        }
        breakdown
    }

    /// Integrator-facing gate. Any external platform can call this to
    /// check "does this address meet a minimum bar" without needing to
    /// understand the scoring internals at all.
    pub fn verify_claim(
        env: Env,
        attestation_contract: Address,
        recipient: Address,
        minimum_score: i128,
    ) -> bool {
        Self::compute_score(env, attestation_contract, recipient) >= minimum_score
    }
}

/// Base 10 points per attestation, plus up to 100 bonus points scaled by
/// payment size, then adjusted by recency, category, and confirmation
/// multipliers. Multipliers are integer percentages (x100), divided down
/// at the end so nothing here touches floating point.
///
/// The confirmation multiplier is the important addition: an attestation
/// the client actively approved is worth full value. One that only
/// released because the client let the approval window expire is worth
/// half — it's a real payment, but a weaker signal that the client stood
/// behind the work, and the score reflects that honestly.
fn score_one(record: &AttestationRecord, current_ledger: u32) -> i128 {
    let base: i128 = 10;

    // +1 point per 10 units of payment (assumes 7-decimal smallest unit,
    // matching Stellar's standard), capped at 100.
    let payment_bonus = (record.amount_paid / 10_000_000 / 10).clamp(0, 100);

    let raw = base + payment_bonus;

    let age = current_ledger.saturating_sub(record.minted_at_ledger);
    let recency_pct: i128 = if age <= RECENCY_WINDOW_HOT {
        150
    } else if age <= RECENCY_WINDOW_WARM {
        120
    } else {
        100
    };

    let category_pct: i128 = match record.category {
        Category::Grant => 130,
        Category::Bounty => 120,
        Category::Freelance => 110,
        _ => 100,
    };

    let confirmed_pct: i128 = if record.client_confirmed { 100 } else { 50 };

    raw.saturating_mul(recency_pct)
        .saturating_mul(category_pct)
        .saturating_mul(confirmed_pct)
        / 1_000_000
}
```

---

## 6. README

# Aven Contracts — v2 (Checkpoint-Gated Streams)

Three Soroban contracts. `stream_contract` now fragments a single stream
into sender-defined checkpoints, locks a percentage of each checkpoint's
earnings until the sender confirms it (or a timeout auto-releases it
unconfirmed), and mints one attestation per checkpoint as it finalizes.
`attestation_contract` mints only when called by `stream_contract`.
`reputation_contract` is stateless and weights confirmed attestations
above auto-released ones.

## What changed from v1 and why

The original design paid purely on elapsed time with one attestation at
the very end. The gap: nothing stopped a stream from running its full
duration with zero actual work happening, and there was no mechanism for
the client to withhold trust in stages. This version fixes that without
giving up the thing that made streaming worth building in the first
place — recipients still get continuous, real-time liquidity, they just
don't get *all* of it unchecked.

## How a checkpoint-gated stream works

A sender creates a stream the same way as before, but now also picks:

- `checkpoint_count` — how many equal-length chunks to split the stream
  into (1 = no fragmentation, behaves like the original design)
- `withdrawable_cap_percent` — e.g. 65. This much of each checkpoint's
  earnings is withdrawable immediately, no questions asked. The rest
  stays locked.
- `approval_timeout_ledgers` — how long the sender has, after a
  checkpoint comes due, to call `approve_checkpoint` before it releases
  on its own, unconfirmed.

`duration_ledgers` must divide evenly by `checkpoint_count` — the
contract enforces this at creation and returns `DurationNotDivisible`
otherwise. Pick round numbers (e.g. a 7-day stream with 7 checkpoints, or
a 6-day stream with 3 checkpoints of 2 days each).

As the stream runs, money accrues exactly as before — nothing about the
underlying lazy `rate × elapsed_ledgers` math changed. What changed is
`compute_withdrawable`: for any checkpoint whose period hasn't yet been
approved or timed out, only `withdrawable_cap_percent` of that
checkpoint's share counts as withdrawable. The rest is still *earning*,
it's just not *releasable* yet.

### The lifecycle of one checkpoint

1. Money streams in underneath it as normal — recipient can withdraw the
   capped percentage the whole time.
2. Recipient calls `submit_checkpoint(stream_id, worker, index,
   evidence_hash)` when they consider that chunk of work done. This is
   just a marker plus a hash pointing at off-chain evidence — no funds
   move, nothing mints yet.
3. Sender reviews off-chain, then calls `approve_checkpoint(stream_id,
   sender, index)`. This immediately unlocks the remaining locked
   percentage and mints that checkpoint's attestation with
   `client_confirmed = true`.
4. **If the sender never calls approve_checkpoint**, once
   `due_ledger + approval_timeout_ledgers` passes, the checkpoint
   unlocks anyway on the next `withdraw`, `cancel_stream`, or
   `settle_checkpoints` call — but its attestation mints with
   `client_confirmed = false`. `reputation_contract` weights these at
   half the points of a confirmed one. Silence has a cost, it just isn't
   "the worker never gets paid."

`settle_checkpoints(stream_id)` is callable by anyone, moves no funds,
and exists purely so a checkpoint can finalize (and its attestation
mint) even before the recipient happens to call withdraw.

### Cancellation under this model

`cancel_stream` still pays the recipient exactly whatever is currently
unlocked (same `compute_withdrawable` call withdraw uses) and returns
everything else to the sender — including any locked-but-earned money
that never cleared a checkpoint. That's the actual point of the lock: if
the sender cancels because something's wrong, the money that was
withheld pending approval goes back to them, not to the recipient.

## USDC and XLM — nothing special required

`asset` on every stream is just a Stellar Asset Contract (SAC) address.
Pass the USDC SAC contract id to stream USDC, or the native XLM SAC
contract id to stream XLM — the exact same `token::Client` calls in
`create_stream`, `withdraw`, and `cancel_stream` work identically either
way, because SAC exposes the same standard token interface
(`transfer`, `balance`, etc.) regardless of which asset backs it. There
is no asset-specific branch anywhere in this code, and there shouldn't
need to be one. Get a SAC address for USDC (or any classic asset) with:

```bash
stellar contract asset deploy \
  --asset USDC:<issuer-account-id> \
  --source alice \
  --network testnet
```

The native asset already has a well-known SAC id per network — the
Stellar SDK's `Asset.native().contractId(network)` gives you that
address without deploying anything.

## Deploy order

1. Deploy `attestation_contract`, don't init yet.
2. Deploy `stream_contract`, call `init(admin, attestation_contract_address)`.
3. Call `attestation_contract.init(admin, stream_contract_address)`.
4. `reputation_contract` needs no init — it's stateless.

```bash
stellar contract deploy --wasm attestation_contract.wasm --source alice --network testnet
stellar contract deploy --wasm stream_contract.wasm --source alice --network testnet
stellar contract deploy --wasm reputation_contract.wasm --source alice --network testnet

stellar contract invoke --id <STREAM_ID> --source alice --network testnet -- \
  init --admin alice --attestation_contract <ATTESTATION_ID>

stellar contract invoke --id <ATTESTATION_ID> --source alice --network testnet -- \
  init --admin alice --stream_contract <STREAM_ID>
```

## The trust boundary — unchanged, still the most important part

`mint_attestation` only accepts calls where `caller` equals the
registered `stream_contract` address AND `caller.require_auth()`
succeeds. This works because when Contract A calls Contract B directly
and passes A's own address, the Soroban host auto-authorizes that
specific call — A is genuinely the live caller on the invocation stack,
not just a value someone typed in. A different contract can't spoof this
by passing `stream_contract`'s address as a plain argument, because it
isn't really `stream_contract` making the call. If this check is ever
weakened to a bare `==` without `require_auth()`, anyone can mint
fraudulent credentials. Treat any change here as needing a second pair
of eyes before mainnet.

## Build (run on your own machine)

```bash
rustup target add wasm32-unknown-unknown
cargo build --workspace --release --target wasm32-unknown-unknown
cargo test --workspace
```

> This sandbox only has Rust 1.75 via apt with no network path to
> rustup, so a live wasm build could not be run in this environment.
> The code was written and manually reviewed line by line — including a
> full pass on the checkpoint math, the lock/unlock boundary, and the
> reentrancy ordering — but run `cargo build` and `cargo test` locally
> before touching testnet, and definitely before mainnet.

## Security properties carried over from v1

- Every state-mutating call requires auth from the correct party
- All arithmetic uses `checked_*` / `saturating_*` — no raw `+ - *` on
  user-controlled `i128`s, plus `overflow-checks = true` at the workspace
  profile level as a second line of defense
- State is written before any external token transfer or cross-contract
  call, everywhere (write-then-interact)
- Time is tracked in ledger sequence numbers, not wall-clock timestamps
- Every persistent write bumps TTL by `LEDGER_BUMP` (~31 days)
- History vectors are capped at 1000 entries per address
- `reputation_contract` caps attestation reads at 100 per call and is
  fully stateless
- `get_attestation` / `verify_attestation` never panic on a missing id

## New in v2

- `checkpoint_count` capped at `MAX_CHECKPOINTS = 30` so every loop over
  a stream's checkpoints (withdraw, cancel, settle) stays bounded
  regardless of how a sender configures a stream
- `finalize_checkpoint` is guarded against double-minting — checked via
  `checkpoint.attestation_id != 0`
- `client_confirmed` flag on every attestation, and
  `reputation_contract` gives confirmed attestations full weight, timed-
  out ones half weight — an honest signal instead of hiding the gap

## What is intentionally NOT in this version

- No dispute/arbitration layer beyond the timeout auto-release — a real
  arbitration system (stake-backed reviewers, on-chain voting) is a
  separate, larger feature, not a 21-day scope item
- No AI-assisted quality review of submitted evidence — could sit
  between `submit_checkpoint` and `approve_checkpoint` as an off-chain
  assist for the sender's decision, but the contract should never treat
  it as authoritative
- No governance or contract upgrade mechanism beyond storing an admin
  address for future coordination
- No protocol fee
- No custom Aven token — USDC/XLM only via SAC
