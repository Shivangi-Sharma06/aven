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
    /// Recomputes a score live from on-chain attestation history every
    /// single call. Nothing is ever cached or stored, so a score can never
    /// be frozen at a high value - it always reflects current chain state.
    pub fn compute_score(env: Env, attestation_contract: Address, recipient: Address) -> i128 {
        let breakdown = Self::get_score_breakdown(env, attestation_contract, recipient);
        breakdown.total
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
                Category::Freelance => breakdown.freelance = breakdown.freelance.saturating_add(points),
                Category::Salary => breakdown.salary = breakdown.salary.saturating_add(points),
                Category::Bounty => breakdown.bounty = breakdown.bounty.saturating_add(points),
                Category::Grant => breakdown.grant = breakdown.grant.saturating_add(points),
                Category::AgentTask => breakdown.agent_task = breakdown.agent_task.saturating_add(points),
                Category::Subscription => breakdown.subscription = breakdown.subscription.saturating_add(points),
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
/// payment size, then adjusted by recency and category multipliers.
/// Multipliers are applied as integer percentages (x100) and divided down
/// at the end so we never touch floating point inside the contract.
fn score_one(record: &AttestationRecord, current_ledger: u32) -> i128 {
    let base: i128 = 10;

    // +1 point per 10 units of payment (asset's smallest unit assumed to
    // carry 7 decimal places, matching Stellar's standard), capped at 100.
    let payment_bonus = (record.total_paid / 10_000_000 / 10).min(100).max(0);

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

    // (raw * recency_pct * category_pct) / (100 * 100)
    raw.saturating_mul(recency_pct)
        .saturating_mul(category_pct)
        / 10_000
}

mod test;