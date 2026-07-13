#![no_std]

use soroban_sdk::{contracttype, Address, BytesN, String};

/// Approximate ledger bump for ~31 days at ~5s/ledger.
pub const LEDGER_BUMP: u32 = 535_680;

/// Seconds per ledger used to convert a per-second rate into a per-ledger rate.
pub const LEDGERS_PER_UNIT: i128 = 5;

/// Hard cap on checkpoints per stream. Keeps loops bounded.
pub const MAX_CHECKPOINTS: u32 = 30;

/// Maximum UTF-8 byte length of human-readable stream/attestation titles.
pub const MAX_TITLE_LEN: u32 = 80;

/// Hard cap on how many attestation ids reputation reads in one call.
pub const MAX_HISTORY_READ: u32 = 100;

/// Hard cap on how many ids are stored against a single address.
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
    pub paused_duration_ledgers: u32,
    pub checkpoint_count: u32,
    pub checkpoint_span_ledgers: u32,
    pub withdrawable_cap_percent: u32,
    pub approval_timeout_ledgers: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct CheckpointRecord {
    pub stream_id: u64,
    pub index: u32,
    pub due_ledger: u32,
    pub submitted: bool,
    pub evidence_hash: BytesN<32>,
    pub approved: bool,
    pub auto_approved: bool,
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
    pub amount_paid: i128,
    pub asset: Address,
    pub category: Category,
    pub title: String,
    pub period_start_ledger: u32,
    pub period_end_ledger: u32,
    pub minted_at_ledger: u32,
    pub client_confirmed: bool,
}
