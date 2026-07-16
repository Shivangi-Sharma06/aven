#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, BytesN,
    Env, String,
};

const LEDGER_TTL: u32 = 535_680;
const SECONDS_PER_LEDGER: i128 = 5;
const MAX_TITLE_LEN: u32 = 100;
const MAX_SESSION_ID_LEN: u32 = 64;

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Verifier,
    Arbitrator,
    NextStreamId,
    Stream(u64),
    Claim(u64, String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StreamStatus {
    Active,
    Paused,
    Closed,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ClaimStatus {
    Pending,
    Approved,
    Disputed,
    Rejected,
    Paid,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Stream {
    pub id: u64,
    pub client: Address,
    pub worker: Address,
    pub asset: Address,
    pub title: String,
    pub rate_per_ledger: i128,
    pub deposited: i128,
    pub paid: i128,
    pub reserved: i128,
    pub start_ledger: u32,
    pub duration_ledgers: u32,
    pub review_window_ledgers: u32,
    pub paused_at: u32,
    pub paused_ledgers: u32,
    pub status: StreamStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkClaim {
    pub stream_id: u64,
    pub session_id: String,
    pub amount: i128,
    pub report_digest: BytesN<32>,
    pub submitted_at: u32,
    pub review_deadline: u32,
    pub status: ClaimStatus,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    InvalidAmount = 3,
    InvalidRate = 4,
    InvalidDuration = 5,
    InvalidReviewWindow = 6,
    InvalidTitle = 7,
    InvalidSessionId = 8,
    StreamNotFound = 9,
    ClaimNotFound = 10,
    ClaimAlreadyExists = 11,
    WrongStatus = 12,
    NotClient = 13,
    NotWorker = 14,
    NotVerifier = 15,
    NotArbitrator = 16,
    AmountNotEarned = 17,
    ReviewStillOpen = 18,
    ClaimDisputed = 19,
    PendingClaims = 20,
    Overflow = 21,
    NotAdmin = 22,
    StreamStillRunning = 23,
}

#[contractevent(topics = ["stream_created"])]
pub struct StreamCreated {
    #[topic]
    pub stream_id: u64,
    #[topic]
    pub client: Address,
    #[topic]
    pub worker: Address,
    pub asset: Address,
    pub deposited: i128,
}

#[contractevent(topics = ["work_verified"])]
pub struct WorkVerified {
    #[topic]
    pub stream_id: u64,
    #[topic]
    pub worker: Address,
    pub session_id: String,
    pub amount: i128,
    pub report_digest: BytesN<32>,
    pub review_deadline: u32,
}

#[contractevent(topics = ["claim_reviewed"])]
pub struct ClaimReviewed {
    #[topic]
    pub stream_id: u64,
    pub session_id: String,
    pub status: ClaimStatus,
}

#[contractevent(topics = ["claim_paid"])]
pub struct ClaimPaid {
    #[topic]
    pub stream_id: u64,
    #[topic]
    pub worker: Address,
    pub session_id: String,
    pub amount: i128,
}

#[contract]
pub struct WorkStreamContract;

#[contractimpl]
impl WorkStreamContract {
    pub fn __constructor(env: Env, admin: Address, verifier: Address, arbitrator: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Verifier, &verifier);
        env.storage()
            .instance()
            .set(&DataKey::Arbitrator, &arbitrator);
        env.storage().instance().set(&DataKey::NextStreamId, &1u64);
        touch_instance(&env);
    }

    pub fn set_verifier(env: Env, admin: Address, verifier: Address) -> Result<(), Error> {
        require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::Verifier, &verifier);
        touch_instance(&env);
        Ok(())
    }

    pub fn set_arbitrator(env: Env, admin: Address, arbitrator: Address) -> Result<(), Error> {
        require_admin(&env, &admin)?;
        env.storage()
            .instance()
            .set(&DataKey::Arbitrator, &arbitrator);
        touch_instance(&env);
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_stream(
        env: Env,
        client: Address,
        worker: Address,
        asset: Address,
        deposit: i128,
        rate_per_second: i128,
        duration_ledgers: u32,
        review_window_ledgers: u32,
        title: String,
    ) -> Result<u64, Error> {
        client.require_auth();
        require_initialized(&env)?;
        touch_instance(&env);

        if deposit <= 0 {
            return Err(Error::InvalidAmount);
        }
        if rate_per_second <= 0 {
            return Err(Error::InvalidRate);
        }
        if duration_ledgers == 0 {
            return Err(Error::InvalidDuration);
        }
        if review_window_ledgers == 0 {
            return Err(Error::InvalidReviewWindow);
        }
        if title.is_empty() || title.len() > MAX_TITLE_LEN {
            return Err(Error::InvalidTitle);
        }

        let rate_per_ledger = rate_per_second
            .checked_mul(SECONDS_PER_LEDGER)
            .ok_or(Error::Overflow)?;
        let maximum_cost = rate_per_ledger
            .checked_mul(duration_ledgers as i128)
            .ok_or(Error::Overflow)?;
        if deposit < maximum_cost {
            return Err(Error::InvalidAmount);
        }

        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextStreamId)
            .unwrap_or(1);
        let next_id = id.checked_add(1).ok_or(Error::Overflow)?;
        env.storage()
            .instance()
            .set(&DataKey::NextStreamId, &next_id);

        token::Client::new(&env, &asset).transfer(
            &client,
            env.current_contract_address(),
            &deposit,
        );

        let stream = Stream {
            id,
            client: client.clone(),
            worker: worker.clone(),
            asset: asset.clone(),
            title,
            rate_per_ledger,
            deposited: deposit,
            paid: 0,
            reserved: 0,
            start_ledger: env.ledger().sequence(),
            duration_ledgers,
            review_window_ledgers,
            paused_at: 0,
            paused_ledgers: 0,
            status: StreamStatus::Active,
        };
        save_stream(&env, &stream);

        StreamCreated {
            stream_id: id,
            client,
            worker,
            asset,
            deposited: deposit,
        }
        .publish(&env);
        Ok(id)
    }

    pub fn verify_work(
        env: Env,
        stream_id: u64,
        session_id: String,
        amount: i128,
        report_digest: BytesN<32>,
    ) -> Result<(), Error> {
        let verifier: Address = env
            .storage()
            .instance()
            .get(&DataKey::Verifier)
            .ok_or(Error::NotInitialized)?;
        verifier.require_auth();

        if session_id.is_empty() || session_id.len() > MAX_SESSION_ID_LEN {
            return Err(Error::InvalidSessionId);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let key = DataKey::Claim(stream_id, session_id.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::ClaimAlreadyExists);
        }

        let mut stream = load_stream(&env, stream_id)?;
        if stream.status == StreamStatus::Closed {
            return Err(Error::WrongStatus);
        }
        if amount > available_earnings(&env, &stream)? {
            return Err(Error::AmountNotEarned);
        }

        stream.reserved = stream.reserved.checked_add(amount).ok_or(Error::Overflow)?;
        let now = env.ledger().sequence();
        let review_deadline = now
            .checked_add(stream.review_window_ledgers)
            .ok_or(Error::Overflow)?;
        let claim = WorkClaim {
            stream_id,
            session_id: session_id.clone(),
            amount,
            report_digest: report_digest.clone(),
            submitted_at: now,
            review_deadline,
            status: ClaimStatus::Pending,
        };

        save_stream(&env, &stream);
        save_claim(&env, &claim);
        WorkVerified {
            stream_id,
            worker: stream.worker,
            session_id,
            amount,
            report_digest,
            review_deadline,
        }
        .publish(&env);
        Ok(())
    }

    pub fn approve_claim(
        env: Env,
        stream_id: u64,
        session_id: String,
        client: Address,
    ) -> Result<(), Error> {
        client.require_auth();
        let stream = load_stream(&env, stream_id)?;
        if client != stream.client {
            return Err(Error::NotClient);
        }
        set_claim_status(&env, stream_id, session_id, ClaimStatus::Approved)
    }

    pub fn dispute_claim(
        env: Env,
        stream_id: u64,
        session_id: String,
        client: Address,
    ) -> Result<(), Error> {
        client.require_auth();
        let stream = load_stream(&env, stream_id)?;
        if client != stream.client {
            return Err(Error::NotClient);
        }
        set_claim_status(&env, stream_id, session_id, ClaimStatus::Disputed)
    }

    pub fn resolve_dispute(
        env: Env,
        stream_id: u64,
        session_id: String,
        approve: bool,
        arbitrator: Address,
    ) -> Result<(), Error> {
        arbitrator.require_auth();
        let expected: Address = env
            .storage()
            .instance()
            .get(&DataKey::Arbitrator)
            .ok_or(Error::NotInitialized)?;
        if arbitrator != expected {
            return Err(Error::NotArbitrator);
        }

        let mut claim = load_claim(&env, stream_id, &session_id)?;
        if claim.status != ClaimStatus::Disputed {
            return Err(Error::WrongStatus);
        }
        claim.status = if approve {
            ClaimStatus::Approved
        } else {
            ClaimStatus::Rejected
        };
        save_claim(&env, &claim);
        if !approve {
            release_reservation(&env, stream_id, claim.amount)?;
        }
        publish_review(&env, &claim);
        Ok(())
    }

    pub fn withdraw(
        env: Env,
        stream_id: u64,
        session_id: String,
        worker: Address,
    ) -> Result<i128, Error> {
        worker.require_auth();
        let mut stream = load_stream(&env, stream_id)?;
        if worker != stream.worker {
            return Err(Error::NotWorker);
        }

        let mut claim = load_claim(&env, stream_id, &session_id)?;
        match claim.status {
            ClaimStatus::Approved => {}
            ClaimStatus::Pending => {
                if env.ledger().sequence() < claim.review_deadline {
                    return Err(Error::ReviewStillOpen);
                }
            }
            ClaimStatus::Disputed => return Err(Error::ClaimDisputed),
            _ => return Err(Error::WrongStatus),
        }

        stream.reserved = stream
            .reserved
            .checked_sub(claim.amount)
            .ok_or(Error::Overflow)?;
        stream.paid = stream
            .paid
            .checked_add(claim.amount)
            .ok_or(Error::Overflow)?;
        claim.status = ClaimStatus::Paid;

        save_stream(&env, &stream);
        save_claim(&env, &claim);
        token::Client::new(&env, &stream.asset).transfer(
            &env.current_contract_address(),
            &worker,
            &claim.amount,
        );

        ClaimPaid {
            stream_id,
            worker,
            session_id,
            amount: claim.amount,
        }
        .publish(&env);
        Ok(claim.amount)
    }

    pub fn pause(env: Env, stream_id: u64, client: Address) -> Result<(), Error> {
        client.require_auth();
        let mut stream = load_stream(&env, stream_id)?;
        if client != stream.client {
            return Err(Error::NotClient);
        }
        if stream.status != StreamStatus::Active {
            return Err(Error::WrongStatus);
        }
        stream.status = StreamStatus::Paused;
        stream.paused_at = env.ledger().sequence();
        save_stream(&env, &stream);
        Ok(())
    }

    pub fn resume(env: Env, stream_id: u64, client: Address) -> Result<(), Error> {
        client.require_auth();
        let mut stream = load_stream(&env, stream_id)?;
        if client != stream.client {
            return Err(Error::NotClient);
        }
        if stream.status != StreamStatus::Paused {
            return Err(Error::WrongStatus);
        }
        stream.paused_ledgers = stream
            .paused_ledgers
            .checked_add(env.ledger().sequence().saturating_sub(stream.paused_at))
            .ok_or(Error::Overflow)?;
        stream.paused_at = 0;
        stream.status = StreamStatus::Active;
        save_stream(&env, &stream);
        Ok(())
    }

    pub fn close(env: Env, stream_id: u64, client: Address) -> Result<i128, Error> {
        client.require_auth();
        let mut stream = load_stream(&env, stream_id)?;
        if client != stream.client {
            return Err(Error::NotClient);
        }
        if stream.reserved != 0 {
            return Err(Error::PendingClaims);
        }
        if stream.status == StreamStatus::Closed {
            return Err(Error::WrongStatus);
        }
        if active_ledgers(&env, &stream) < stream.duration_ledgers {
            return Err(Error::StreamStillRunning);
        }

        let refund = stream
            .deposited
            .checked_sub(stream.paid)
            .ok_or(Error::Overflow)?;
        stream.status = StreamStatus::Closed;
        save_stream(&env, &stream);
        if refund > 0 {
            token::Client::new(&env, &stream.asset).transfer(
                &env.current_contract_address(),
                &client,
                &refund,
            );
        }
        Ok(refund)
    }

    pub fn get_stream(env: Env, stream_id: u64) -> Result<Stream, Error> {
        load_stream(&env, stream_id)
    }

    pub fn get_claim(env: Env, stream_id: u64, session_id: String) -> Result<WorkClaim, Error> {
        load_claim(&env, stream_id, &session_id)
    }

    pub fn earned(env: Env, stream_id: u64) -> Result<i128, Error> {
        let stream = load_stream(&env, stream_id)?;
        gross_earnings(&env, &stream)
    }

    pub fn available(env: Env, stream_id: u64) -> Result<i128, Error> {
        let stream = load_stream(&env, stream_id)?;
        available_earnings(&env, &stream)
    }
}

fn require_initialized(env: &Env) -> Result<(), Error> {
    if env.storage().instance().has(&DataKey::Verifier) {
        Ok(())
    } else {
        Err(Error::NotInitialized)
    }
}

fn require_admin(env: &Env, admin: &Address) -> Result<(), Error> {
    admin.require_auth();
    let expected: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)?;
    if admin != &expected {
        return Err(Error::NotAdmin);
    }
    Ok(())
}

fn touch_instance(env: &Env) {
    env.storage().instance().extend_ttl(LEDGER_TTL, LEDGER_TTL);
}

fn save_stream(env: &Env, stream: &Stream) {
    let key = DataKey::Stream(stream.id);
    env.storage().persistent().set(&key, stream);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_TTL, LEDGER_TTL);
}

fn load_stream(env: &Env, stream_id: u64) -> Result<Stream, Error> {
    let key = DataKey::Stream(stream_id);
    let stream = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::StreamNotFound)?;
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_TTL, LEDGER_TTL);
    Ok(stream)
}

fn save_claim(env: &Env, claim: &WorkClaim) {
    let key = DataKey::Claim(claim.stream_id, claim.session_id.clone());
    env.storage().persistent().set(&key, claim);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_TTL, LEDGER_TTL);
}

fn load_claim(env: &Env, stream_id: u64, session_id: &String) -> Result<WorkClaim, Error> {
    let key = DataKey::Claim(stream_id, session_id.clone());
    let claim = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::ClaimNotFound)?;
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_TTL, LEDGER_TTL);
    Ok(claim)
}

fn set_claim_status(
    env: &Env,
    stream_id: u64,
    session_id: String,
    status: ClaimStatus,
) -> Result<(), Error> {
    let mut claim = load_claim(env, stream_id, &session_id)?;
    if claim.status != ClaimStatus::Pending {
        return Err(Error::WrongStatus);
    }
    claim.status = status;
    save_claim(env, &claim);
    publish_review(env, &claim);
    Ok(())
}

fn publish_review(env: &Env, claim: &WorkClaim) {
    ClaimReviewed {
        stream_id: claim.stream_id,
        session_id: claim.session_id.clone(),
        status: claim.status.clone(),
    }
    .publish(env);
}

fn release_reservation(env: &Env, stream_id: u64, amount: i128) -> Result<(), Error> {
    let mut stream = load_stream(env, stream_id)?;
    stream.reserved = stream.reserved.checked_sub(amount).ok_or(Error::Overflow)?;
    save_stream(env, &stream);
    Ok(())
}

fn gross_earnings(env: &Env, stream: &Stream) -> Result<i128, Error> {
    if stream.status == StreamStatus::Closed {
        return Ok(stream.paid);
    }
    let elapsed = active_ledgers(env, stream);
    let earned = stream
        .rate_per_ledger
        .checked_mul(elapsed as i128)
        .ok_or(Error::Overflow)?;
    Ok(earned.min(stream.deposited))
}

fn active_ledgers(env: &Env, stream: &Stream) -> u32 {
    let end = if stream.status == StreamStatus::Paused {
        stream.paused_at
    } else {
        env.ledger().sequence()
    };
    end.saturating_sub(stream.start_ledger)
        .saturating_sub(stream.paused_ledgers)
        .min(stream.duration_ledgers)
}

fn available_earnings(env: &Env, stream: &Stream) -> Result<i128, Error> {
    let committed = stream
        .paid
        .checked_add(stream.reserved)
        .ok_or(Error::Overflow)?;
    let available = gross_earnings(env, stream)?
        .checked_sub(committed)
        .ok_or(Error::Overflow)?;
    Ok(available.max(0))
}

#[cfg(test)]
mod test;
