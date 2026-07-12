#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    contract, contractimpl, contracttype,
    testutils::{Address as _, Ledger},
    Address, Env, String, Vec,
};

#[contracttype]
#[derive(Clone)]
enum MockKey {
    Attestation(u64),
    Recipient(Address),
    Next,
}

#[contract]
struct MockAttestation;

#[contractimpl]
impl MockAttestation {
    pub fn add(
        env: Env,
        recipient: Address,
        total_paid: i128,
        category: Category,
        minted_at_ledger: u32,
    ) -> u64 {
        let id: u64 = env.storage().instance().get(&MockKey::Next).unwrap_or(1);
        env.storage()
            .instance()
            .set(&MockKey::Next, &id.checked_add(1).expect("id overflow"));

        let mut ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&MockKey::Recipient(recipient.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        ids.push_back(id);
        env.storage()
            .persistent()
            .set(&MockKey::Recipient(recipient.clone()), &ids);

        let sender = Address::generate(&env);
        let record = AttestationRecord {
            id,
            stream_id: id,
            sender,
            recipient: recipient.clone(),
            total_paid,
            asset: Address::generate(&env),
            category,
            title: String::from_str(&env, "Work"),
            start_ledger: 1,
            end_ledger: 2,
            minted_at_ledger,
        };
        env.storage()
            .persistent()
            .set(&MockKey::Attestation(id), &record);
        id
    }

    pub fn get_attestation(env: Env, attestation_id: u64) -> AttestationRecord {
        env.storage()
            .persistent()
            .get(&MockKey::Attestation(attestation_id))
            .expect("attestation not found")
    }

    pub fn get_recipient_attestations(env: Env, recipient: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&MockKey::Recipient(recipient))
            .unwrap_or_else(|| Vec::new(&env))
    }
}

fn setup<'a>(
    env: &'a Env,
) -> (
    ReputationContractClient<'a>,
    MockAttestationClient<'a>,
    Address,
) {
    let mock_id = env.register(MockAttestation, ());
    let reputation_id = env.register(ReputationContract, (&mock_id,));
    (
        ReputationContractClient::new(env, &reputation_id),
        MockAttestationClient::new(env, &mock_id),
        mock_id,
    )
}

#[test]
fn test_compute_score_empty() {
    let env = Env::default();
    let recipient = Address::generate(&env);
    let (client, _mock, mock_id) = setup(&env);

    assert_eq!(client.compute_score(&mock_id, &recipient), 0);
}

#[test]
fn test_compute_score_multiple() {
    let env = Env::default();
    env.ledger().set_sequence_number(200_000);
    let recipient = Address::generate(&env);
    let (client, mock, mock_id) = setup(&env);

    mock.add(&recipient, &100_000_000, &Category::Freelance, &199_000);
    mock.add(&recipient, &1_000_000_000, &Category::Grant, &100_000);

    assert_eq!(client.compute_score(&mock_id, &recipient), 57);
    let breakdown = client.get_score_breakdown(&mock_id, &recipient);
    assert_eq!(breakdown.freelance, 18);
    assert_eq!(breakdown.grant, 39);
    assert_eq!(breakdown.total, 57);
}

#[test]
fn test_verify_claim_above_threshold() {
    let env = Env::default();
    env.ledger().set_sequence_number(200_000);
    let recipient = Address::generate(&env);
    let (client, mock, mock_id) = setup(&env);
    mock.add(&recipient, &1_000_000_000, &Category::Grant, &199_000);

    assert!(client.verify_claim(&mock_id, &recipient, &30));
}

#[test]
fn test_verify_claim_below_threshold() {
    let env = Env::default();
    env.ledger().set_sequence_number(200_000);
    let recipient = Address::generate(&env);
    let (client, mock, mock_id) = setup(&env);
    mock.add(&recipient, &100_000_000, &Category::Salary, &100_000);

    assert!(!client.verify_claim(&mock_id, &recipient, &50));
}

#[test]
fn test_spoofed_attestation_contract_scores_zero() {
    let env = Env::default();
    env.ledger().set_sequence_number(200_000);
    let recipient = Address::generate(&env);
    let (client, mock, _mock_id) = setup(&env);
    let spoofed_id = env.register(MockAttestation, ());
    mock.add(&recipient, &1_000_000_000, &Category::Grant, &199_000);

    assert_eq!(client.compute_score(&spoofed_id, &recipient), 0);
    assert!(!client.verify_claim(&spoofed_id, &recipient, &1));
}

#[test]
fn test_negative_threshold_rejected() {
    let env = Env::default();
    let recipient = Address::generate(&env);
    let (client, _mock, mock_id) = setup(&env);

    assert!(!client.verify_claim(&mock_id, &recipient, &-1));
}
