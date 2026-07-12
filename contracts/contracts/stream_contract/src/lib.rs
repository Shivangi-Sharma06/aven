#![no_std]

use shared::{
    Category, StreamRecord, StreamStatus, LEDGERS_PER_UNIT, LEDGER_BUMP, MAX_HISTORY_LEN,
    MAX_TITLE_LEN,
};
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, vec, Address, Env,
    IntoVal, String, Symbol, Vec,
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

#[contractevent(topics = ["stream_withdrawn"])]
pub struct StreamWithdrawn {
    #[topic]
    pub stream_id: u64,
    #[topic]
    pub recipient: Address,
    pub amount: i128,
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

#[contractevent(topics = ["stream_completed"])]
pub struct StreamCompleted {
    #[topic]
    pub stream_id: u64,
    #[topic]
    pub attestation_id: u64,
    pub total_paid: i128,
    pub refunded_to_sender: i128,
}

#[contract]
pub struct StreamContract;

#[contractimpl]
impl StreamContract {
    /// Atomic deployment-time setup. The admin is reserved for deployment and
    /// upgrade coordination only; user funds can only move through stream
    /// lifecycle functions.
    pub fn __constructor(env: Env, admin: Address, attestation_contract: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::AttestationContract, &attestation_contract);
        env.storage().instance().set(&DataKey::NextStreamId, &1u64);
        env.storage()
            .instance()
            .extend_ttl(LEDGER_BUMP, LEDGER_BUMP);
    }

    /// Creates a new stream. Pulls `total_deposited` of `asset` from
    /// `sender` into this contract via the SAC token interface. Funds are
    /// only ever released via withdraw/cancel/complete - never on creation.
    pub fn create_stream(
        env: Env,
        sender: Address,
        recipient: Address,
        rate_per_second: i128,
        asset: Address,
        total_deposited: i128,
        duration_ledgers: u32,
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
            attestation_id: 0,
            has_attestation: false,
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

    /// Recipient withdraws whatever has been earned but not yet withdrawn.
    /// If the stream's duration has fully elapsed, this call also finalizes
    /// the stream and triggers attestation minting.
    pub fn withdraw(env: Env, stream_id: u64, caller: Address) -> Result<i128, Error> {
        caller.require_auth();
        bump_instance(&env);

        let mut stream = load_stream(&env, stream_id)?;
        if caller != stream.recipient {
            return Err(Error::NotRecipient);
        }
        if stream.status != StreamStatus::Active && stream.status != StreamStatus::Paused {
            return Err(Error::WrongStatus);
        }

        let withdrawable = compute_withdrawable(&env, &stream)?;
        if withdrawable <= 0 {
            return Err(Error::NothingToWithdraw);
        }

        stream.total_withdrawn = stream
            .total_withdrawn
            .checked_add(withdrawable)
            .ok_or(Error::Overflow)?;
        save_stream(&env, &stream);

        let token_client = token::Client::new(&env, &stream.asset);
        token_client.transfer(
            &env.current_contract_address(),
            &stream.recipient,
            &withdrawable,
        );

        StreamWithdrawn {
            stream_id,
            recipient: stream.recipient.clone(),
            amount: withdrawable,
        }
        .publish(&env);

        let elapsed = elapsed_active_ledgers(&env, &stream);
        if elapsed >= stream.duration_ledgers {
            complete_stream(&env, &mut stream)?;
        }

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

    /// Sender cancels the stream. The recipient is paid whatever they had
    /// already earned; every remaining unstreamed unit returns to the
    /// sender. The two payouts always sum to exactly
    /// `total_deposited - total_withdrawn(before cancel)`.
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

        let earned = compute_withdrawable(&env, &stream)?;
        let remaining_pool = stream
            .total_deposited
            .checked_sub(stream.total_withdrawn)
            .ok_or(Error::Overflow)?;
        let refund_to_sender = remaining_pool.checked_sub(earned).ok_or(Error::Overflow)?;

        stream.total_withdrawn = stream
            .total_withdrawn
            .checked_add(earned)
            .ok_or(Error::Overflow)?;
        stream.status = StreamStatus::Cancelled;
        save_stream(&env, &stream);

        let token_client = token::Client::new(&env, &stream.asset);
        if earned > 0 {
            token_client.transfer(&env.current_contract_address(), &stream.recipient, &earned);
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
            paid_to_recipient: earned,
            refunded_to_sender: refund_to_sender,
        }
        .publish(&env);
        Ok(())
    }

    pub fn get_stream(env: Env, stream_id: u64) -> Result<StreamRecord, Error> {
        load_stream(&env, stream_id)
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

    /// Read-only view of the currently withdrawable amount. Safe to call
    /// from the frontend on every tick - it touches no storage writes.
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

/// Ledgers during which the stream was actually earning - i.e. wall-clock
/// elapsed ledgers minus every ledger spent paused, and minus the current
/// open pause if one is in progress. Capped at duration_ledgers because a
/// stream cannot earn more than its total allotted duration.
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

fn compute_withdrawable(env: &Env, stream: &StreamRecord) -> Result<i128, Error> {
    if stream.status == StreamStatus::Cancelled {
        return Ok(0);
    }

    let elapsed = elapsed_active_ledgers(env, stream);
    let earned = stream
        .rate_per_ledger
        .checked_mul(elapsed as i128)
        .ok_or(Error::Overflow)?;

    let earned_capped = if earned > stream.total_deposited {
        stream.total_deposited
    } else {
        earned
    };

    let withdrawable = earned_capped
        .checked_sub(stream.total_withdrawn)
        .ok_or(Error::Overflow)?;

    Ok(if withdrawable < 0 { 0 } else { withdrawable })
}

/// Finalizes a stream: marks it Completed, returns any dust/unstreamed
/// remainder to the sender, and calls into AttestationContract to mint the
/// permanent work credential. Both parties' addresses, the amount paid and
/// the duration all come from data this contract itself wrote - the
/// attestation is generated by the payment event, not typed in by anyone.
fn complete_stream(env: &Env, stream: &mut StreamRecord) -> Result<(), Error> {
    let remainder = stream
        .total_deposited
        .checked_sub(stream.total_withdrawn)
        .ok_or(Error::Overflow)?;

    stream.status = StreamStatus::Completed;
    save_stream(env, stream);

    if remainder > 0 {
        let token_client = token::Client::new(env, &stream.asset);
        token_client.transfer(&env.current_contract_address(), &stream.sender, &remainder);
    }

    let attestation_contract: Address = env
        .storage()
        .instance()
        .get(&DataKey::AttestationContract)
        .ok_or(Error::NotInitialized)?;
    let current_contract = env.current_contract_address();

    let args: Vec<soroban_sdk::Val> = vec![
        env,
        current_contract.into_val(env),
        stream.id.into_val(env),
        stream.sender.clone().into_val(env),
        stream.recipient.clone().into_val(env),
        stream.total_withdrawn.into_val(env),
        stream.asset.clone().into_val(env),
        stream.category.clone().into_val(env),
        stream.title.clone().into_val(env),
        stream.start_ledger.into_val(env),
        env.ledger().sequence().into_val(env),
    ];

    let attestation_id: u64 = env.invoke_contract(
        &attestation_contract,
        &Symbol::new(env, "mint_attestation"),
        args,
    );

    stream.attestation_id = attestation_id;
    stream.has_attestation = true;
    save_stream(env, stream);

    StreamCompleted {
        stream_id: stream.id,
        attestation_id,
        total_paid: stream.total_withdrawn,
        refunded_to_sender: remainder,
    }
    .publish(env);

    Ok(())
}

mod test;
