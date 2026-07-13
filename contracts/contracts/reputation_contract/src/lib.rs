#![no_std]

use shared::{AttestationRecord, Category, MAX_HISTORY_READ};
use soroban_sdk::{contract, contractimpl, contracttype, vec, Address, Env, IntoVal, Symbol, Vec};

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

const RECENCY_WINDOW_HOT: u32 = 120_960;
const RECENCY_WINDOW_WARM: u32 = 864_000;
const SCORE_CAP: i128 = 10_000;

#[contract]
pub struct ReputationContract;

#[contractimpl]
impl ReputationContract {
    pub fn compute_score(env: Env, attestation_contract: Address, recipient: Address) -> i128 {
        Self::get_score_breakdown(env, attestation_contract, recipient).total
    }

    pub fn get_score_breakdown(
        env: Env,
        attestation_contract: Address,
        recipient: Address,
    ) -> ScoreBreakdown {
        let ids: Vec<u64> = env.invoke_contract(
            &attestation_contract,
            &Symbol::new(&env, "get_recipient_attestations"),
            vec![&env, recipient.into_val(&env)],
        );

        let mut breakdown = empty_breakdown();
        let current_ledger = env.ledger().sequence();
        let read_count = if ids.len() > MAX_HISTORY_READ {
            MAX_HISTORY_READ
        } else {
            ids.len()
        };

        let mut i: u32 = 0;
        while i < read_count {
            let id = ids.get(i).unwrap();
            let record: AttestationRecord = env.invoke_contract(
                &attestation_contract,
                &Symbol::new(&env, "get_attestation"),
                vec![&env, id.into_val(&env)],
            );
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

    pub fn verify_claim(
        env: Env,
        attestation_contract: Address,
        recipient: Address,
        minimum_score: i128,
    ) -> bool {
        if minimum_score < 0 {
            return false;
        }
        Self::compute_score(env, attestation_contract, recipient) >= minimum_score
    }
}

fn empty_breakdown() -> ScoreBreakdown {
    ScoreBreakdown {
        total: 0,
        freelance: 0,
        salary: 0,
        bounty: 0,
        grant: 0,
        agent_task: 0,
        subscription: 0,
    }
}

fn score_one(record: &AttestationRecord, current_ledger: u32) -> i128 {
    let base: i128 = 10;
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

mod test;
