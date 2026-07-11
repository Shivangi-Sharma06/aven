#![no_std]

use soroban_sdk::{contracttype, Address, String};

/// Approximate ledger bump for ~31 days at ~5s/ledger.
/// Used as both the "extend to" and "threshold" argument for extend_ttl calls.
pub const LEDGER_BUMP: u32 = 535_680;

/// Ledgers per second used to convert a per-second rate into a per-ledger rate.
/// Stellar targets ~5s per ledger. All "per second" rates supplied by the
/// frontend are converted to "per ledger" by multiplying by this constant
/// before being stored, so on-chain math never has to divide.
pub const LEDGERS_PER_UNIT: i128 = 5;

/// Hard cap on how many attestation/stream ids we will iterate over in a
/// single read call, to keep resource consumption bounded and predictable.
pub const MAX_HISTORY_READ: u32 = 100;

/// Hard cap on how many ids we will ever store against a single address,
/// to keep storage growth (and therefore rent) bounded per account.
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
    /// Amount earned per ledger (already converted from the per-second rate
    /// supplied at creation time). Stored so on-chain math is a single
    /// multiplication with no division.
    pub rate_per_ledger: i128,
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
    pub attestation_id: u64,
    /// 0 means "no attestation minted yet" (id 0 is never issued).
    pub has_attestation: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct AttestationRecord {
    pub id: u64,
    pub stream_id: u64,
    pub sender: Address,
    pub recipient: Address,
    pub total_paid: i128,
    pub asset: Address,
    pub category: Category,
    pub title: String,
    pub start_ledger: u32,
    pub end_ledger: u32,
    pub minted_at_ledger: u32,
}
