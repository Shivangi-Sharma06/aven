#![no_std]

use shared::{
    Category, CheckpointRecord, StreamRecord, StreamStatus, LEDGERS_PER_UNIT, LEDGER_BUMP,
    MAX_CHECKPOINTS, MAX_HISTORY_LEN, MAX_TITLE_LEN,
};
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, vec, Address,
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
    Withdrawal(u64, String),
    ReservedWithdrawals(u64),
}

const MAX_WITHDRAWAL_REQUEST_ID_LEN: u32 = 64;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WithdrawalStatus {
    Pending,
    Approved,
    Disputed,
    Withdrawn,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WithdrawalRecord {
    pub stream_id: u64,
    pub request_id: String,
    pub amount: i128,
    pub requested_at_ledger: u32,
    pub deadline_ledger: u32,
    pub status: WithdrawalStatus,
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
    InvalidRequestId = 22,
    InvalidAmount = 23,
    AmountExceedsWithdrawable = 24,
    WithdrawalNotFound = 25,
    WithdrawalAlreadyExists = 26,
    WithdrawalNotApproved = 27,
    WithdrawalDisputed = 28,
    WithdrawalApprovalRequired = 29,
}

#[contractevent(topics = ["stream_created"])]
pub struct StreamCreated {
    #[topic]
    pub stream_id: u64,
    #[topic]
    pub sender: Address,
    #[topic]
    pub recipient: Address,
    pub asset: Address,
    pub total_deposited: i128,
}

#[contractevent(topics = ["checkpoint_submitted"])]
pub struct CheckpointSubmitted {
    #[topic]
    pub stream_id: u64,
    #[topic]
    pub index: u32,
}

#[contractevent(topics = ["checkpoint_approved"])]
pub struct CheckpointApproved {
    #[topic]
    pub stream_id: u64,
    #[topic]
    pub index: u32,
    pub attestation_id: u64,
}

#[contractevent(topics = ["checkpoint_finalized"])]
pub struct CheckpointFinalized {
    #[topic]
    pub stream_id: u64,
    #[topic]
    pub index: u32,
    pub attestation_id: u64,
    pub client_confirmed: bool,
}

#[contractevent(topics = ["stream_withdrawn"])]
pub struct StreamWithdrawn {
    #[topic]
    pub stream_id: u64,
    #[topic]
    pub recipient: Address,
    pub amount: i128,
}

#[contractevent(topics = ["withdrawal_requested"])]
pub struct WithdrawalRequested {
    #[topic]
    pub stream_id: u64,
    #[topic]
    pub recipient: Address,
    pub request_id: String,
    pub amount: i128,
    pub deadline_ledger: u32,
}

#[contractevent(topics = ["withdrawal_approved"])]
pub struct WithdrawalApproved {
    #[topic]
    pub stream_id: u64,
    #[topic]
    pub sender: Address,
    pub request_id: String,
}

#[contractevent(topics = ["withdrawal_disputed"])]
pub struct WithdrawalDisputed {
    #[topic]
    pub stream_id: u64,
    #[topic]
    pub sender: Address,
    pub request_id: String,
}

#[contractevent(topics = ["stream_paused"])]
pub struct StreamPaused {
    #[topic]
    pub stream_id: u64,
    pub paused_at_ledger: u32,
}

#[contractevent(topics = ["stream_resumed"])]
pub struct StreamResumed {
    #[topic]
    pub stream_id: u64,
    pub resumed_at_ledger: u32,
}

#[contractevent(topics = ["stream_cancelled"])]
pub struct StreamCancelled {
    #[topic]
    pub stream_id: u64,
    pub paid_to_recipient: i128,
    pub refunded_to_sender: i128,
}

#[contract]
pub struct StreamContract;

#[contractimpl]
impl StreamContract {
    pub fn init(env: Env, admin: Address, attestation_contract: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::AttestationContract, &attestation_contract);
        env.storage().instance().set(&DataKey::NextStreamId, &1u64);
        bump_instance(&env);
        Ok(())
    }

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
        require_initialized(&env)?;

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
        let rate_per_ledger = rate_per_second
            .checked_mul(LEDGERS_PER_UNIT)
            .ok_or(Error::Overflow)?;
        let required = rate_per_ledger
            .checked_mul(duration_ledgers as i128)
            .ok_or(Error::Overflow)?;
        if total_deposited < required {
            return Err(Error::InsufficientDeposit);
        }

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
        append_id(&env, DataKey::RecipientStreams(recipient.clone()), id)?;

        StreamCreated {
            stream_id: id,
            sender: record.sender.clone(),
            recipient,
            asset: record.asset.clone(),
            total_deposited,
        }
        .publish(&env);

        Ok(id)
    }

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

        CheckpointSubmitted { stream_id, index }.publish(&env);
        Ok(())
    }

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

        CheckpointApproved {
            stream_id,
            index,
            attestation_id,
        }
        .publish(&env);
        Ok(attestation_id)
    }

    pub fn settle_checkpoints(env: Env, stream_id: u64) -> Result<u32, Error> {
        bump_instance(&env);
        let stream = load_stream(&env, stream_id)?;
        finalize_due_checkpoints(&env, &stream)
    }

    pub fn withdraw(env: Env, stream_id: u64, caller: Address) -> Result<i128, Error> {
        caller.require_auth();
        bump_instance(&env);

        let stream = load_stream(&env, stream_id)?;
        if caller != stream.recipient {
            return Err(Error::NotRecipient);
        }
        Err(Error::WithdrawalApprovalRequired)
    }

    pub fn request_withdrawal(
        env: Env,
        stream_id: u64,
        recipient: Address,
        request_id: String,
        amount: i128,
    ) -> Result<(), Error> {
        recipient.require_auth();
        bump_instance(&env);

        let stream = load_stream(&env, stream_id)?;
        if recipient != stream.recipient {
            return Err(Error::NotRecipient);
        }
        require_withdrawable_status(&stream)?;
        if request_id.len() == 0 || request_id.len() > MAX_WITHDRAWAL_REQUEST_ID_LEN {
            return Err(Error::InvalidRequestId);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let key = DataKey::Withdrawal(stream_id, request_id.clone());
        if let Some(existing) = env.storage().persistent().get::<_, WithdrawalRecord>(&key) {
            if existing.amount == amount && existing.status == WithdrawalStatus::Pending {
                return Ok(());
            }
            return Err(Error::WithdrawalAlreadyExists);
        }

        finalize_due_checkpoints(&env, &stream)?;
        let withdrawable = compute_withdrawable(&env, &stream)?;
        let reserved = load_reserved(&env, stream_id);
        let available = withdrawable.checked_sub(reserved).ok_or(Error::Overflow)?;
        if amount > available {
            return Err(Error::AmountExceedsWithdrawable);
        }

        let requested_at_ledger = env.ledger().sequence();
        let deadline_ledger = requested_at_ledger
            .checked_add(stream.approval_timeout_ledgers)
            .ok_or(Error::Overflow)?;
        let record = WithdrawalRecord {
            stream_id,
            request_id: request_id.clone(),
            amount,
            requested_at_ledger,
            deadline_ledger,
            status: WithdrawalStatus::Pending,
        };
        save_withdrawal(&env, &record);
        save_reserved(
            &env,
            stream_id,
            reserved.checked_add(amount).ok_or(Error::Overflow)?,
        );

        WithdrawalRequested {
            stream_id,
            recipient,
            request_id,
            amount,
            deadline_ledger,
        }
        .publish(&env);
        Ok(())
    }

    pub fn approve_withdrawal(
        env: Env,
        stream_id: u64,
        sender: Address,
        request_id: String,
    ) -> Result<(), Error> {
        sender.require_auth();
        bump_instance(&env);
        let stream = load_stream(&env, stream_id)?;
        if sender != stream.sender {
            return Err(Error::NotSender);
        }
        let mut record = load_withdrawal(&env, stream_id, &request_id)?;
        match record.status {
            WithdrawalStatus::Pending => record.status = WithdrawalStatus::Approved,
            WithdrawalStatus::Approved => return Ok(()),
            WithdrawalStatus::Disputed => return Err(Error::WithdrawalDisputed),
            WithdrawalStatus::Withdrawn => return Err(Error::WithdrawalAlreadyExists),
        }
        save_withdrawal(&env, &record);
        WithdrawalApproved { stream_id, sender, request_id }.publish(&env);
        Ok(())
    }

    pub fn dispute_withdrawal(
        env: Env,
        stream_id: u64,
        sender: Address,
        request_id: String,
    ) -> Result<(), Error> {
        sender.require_auth();
        bump_instance(&env);
        let stream = load_stream(&env, stream_id)?;
        if sender != stream.sender {
            return Err(Error::NotSender);
        }
        let mut record = load_withdrawal(&env, stream_id, &request_id)?;
        match record.status {
            WithdrawalStatus::Pending => record.status = WithdrawalStatus::Disputed,
            WithdrawalStatus::Disputed => return Ok(()),
            WithdrawalStatus::Approved | WithdrawalStatus::Withdrawn => {
                return Err(Error::WithdrawalAlreadyExists)
            }
        }
        let reserved = load_reserved(&env, stream_id);
        save_reserved(
            &env,
            stream_id,
            reserved.checked_sub(record.amount).ok_or(Error::Overflow)?,
        );
        save_withdrawal(&env, &record);
        WithdrawalDisputed { stream_id, sender, request_id }.publish(&env);
        Ok(())
    }

    pub fn withdraw_approved(
        env: Env,
        stream_id: u64,
        recipient: Address,
        request_id: String,
    ) -> Result<i128, Error> {
        recipient.require_auth();
        bump_instance(&env);
        let mut stream = load_stream(&env, stream_id)?;
        if recipient != stream.recipient {
            return Err(Error::NotRecipient);
        }
        require_withdrawable_status(&stream)?;
        let mut record = load_withdrawal(&env, stream_id, &request_id)?;
        match record.status {
            WithdrawalStatus::Approved => {}
            WithdrawalStatus::Pending if env.ledger().sequence() >= record.deadline_ledger => {}
            WithdrawalStatus::Pending => return Err(Error::WithdrawalNotApproved),
            WithdrawalStatus::Disputed => return Err(Error::WithdrawalDisputed),
            WithdrawalStatus::Withdrawn => return Err(Error::NothingToWithdraw),
        }

        finalize_due_checkpoints(&env, &stream)?;
        if record.amount > compute_withdrawable(&env, &stream)? {
            return Err(Error::AmountExceedsWithdrawable);
        }
        let reserved = load_reserved(&env, stream_id);
        let next_reserved = reserved.checked_sub(record.amount).ok_or(Error::Overflow)?;
        stream.total_withdrawn = stream
            .total_withdrawn
            .checked_add(record.amount)
            .ok_or(Error::Overflow)?;
        if elapsed_active_ledgers(&env, &stream) >= stream.duration_ledgers {
            stream.status = StreamStatus::Completed;
        }
        record.status = WithdrawalStatus::Withdrawn;
        save_stream(&env, &stream);
        save_reserved(&env, stream_id, next_reserved);
        save_withdrawal(&env, &record);

        token::Client::new(&env, &stream.asset).transfer(
            &env.current_contract_address(),
            &recipient,
            &record.amount,
        );
        StreamWithdrawn { stream_id, recipient, amount: record.amount }.publish(&env);
        Ok(record.amount)
    }

    pub fn get_withdrawal(
        env: Env,
        stream_id: u64,
        request_id: String,
    ) -> Result<WithdrawalRecord, Error> {
        load_withdrawal(&env, stream_id, &request_id)
    }

    pub fn compute_available(env: Env, stream_id: u64) -> Result<i128, Error> {
        let stream = load_stream(&env, stream_id)?;
        let available = compute_withdrawable(&env, &stream)?
            .checked_sub(load_reserved(&env, stream_id))
            .ok_or(Error::Overflow)?;
        Ok(if available < 0 { 0 } else { available })
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

        StreamPaused {
            stream_id,
            paused_at_ledger: stream.paused_at_ledger,
        }
        .publish(&env);
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

        StreamResumed {
            stream_id,
            resumed_at_ledger: now,
        }
        .publish(&env);
        Ok(())
    }

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

        StreamCancelled {
            stream_id,
            paid_to_recipient: earned_unlocked,
            refunded_to_sender: refund_to_sender,
        }
        .publish(&env);
        Ok(())
    }

    pub fn get_stream(env: Env, stream_id: u64) -> Result<StreamRecord, Error> {
        load_stream(&env, stream_id)
    }

    pub fn get_checkpoint(env: Env, stream_id: u64, index: u32) -> Result<CheckpointRecord, Error> {
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

    pub fn compute_earned(env: Env, stream_id: u64) -> Result<i128, Error> {
        let stream = load_stream(&env, stream_id)?;
        compute_withdrawable(&env, &stream)
    }
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(LEDGER_BUMP, LEDGER_BUMP);
}

fn require_initialized(env: &Env) -> Result<(), Error> {
    if env.storage().instance().has(&DataKey::AttestationContract) {
        Ok(())
    } else {
        Err(Error::NotInitialized)
    }
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

fn require_withdrawable_status(stream: &StreamRecord) -> Result<(), Error> {
    if stream.status == StreamStatus::Active
        || stream.status == StreamStatus::Paused
        || stream.status == StreamStatus::Completed
    {
        Ok(())
    } else {
        Err(Error::WrongStatus)
    }
}

fn load_reserved(env: &Env, stream_id: u64) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::ReservedWithdrawals(stream_id))
        .unwrap_or(0)
}

fn save_reserved(env: &Env, stream_id: u64, amount: i128) {
    let key = DataKey::ReservedWithdrawals(stream_id);
    env.storage().persistent().set(&key, &amount);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_BUMP, LEDGER_BUMP);
}

fn load_withdrawal(
    env: &Env,
    stream_id: u64,
    request_id: &String,
) -> Result<WithdrawalRecord, Error> {
    let key = DataKey::Withdrawal(stream_id, request_id.clone());
    let record = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::WithdrawalNotFound)?;
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_BUMP, LEDGER_BUMP);
    Ok(record)
}

fn save_withdrawal(env: &Env, record: &WithdrawalRecord) {
    let key = DataKey::Withdrawal(record.stream_id, record.request_id.clone());
    env.storage().persistent().set(&key, record);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_BUMP, LEDGER_BUMP);
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

fn compute_withdrawable(env: &Env, stream: &StreamRecord) -> Result<i128, Error> {
    if stream.status == StreamStatus::Cancelled {
        return Ok(0);
    }

    let elapsed = elapsed_active_ledgers(env, stream);
    let span = stream.checkpoint_span_ledgers;
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
        total_earned = total_earned
            .checked_add(contribution)
            .ok_or(Error::Overflow)?;
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

    CheckpointFinalized {
        stream_id: stream.id,
        index: checkpoint.index,
        attestation_id,
        client_confirmed,
    }
    .publish(env);

    Ok(attestation_id)
}

mod test;
