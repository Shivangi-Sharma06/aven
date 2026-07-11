#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup() -> (Env, AttestationContractClient<'static>, Address, Address, Address) {
    let env = Env::default();
    let admin = Address::generate(&env);
    let stream_contract = Address::generate(&env);
    let contract_id = env.register(AttestationContract, ());
    let client = AttestationContractClient::new(&env, &contract_id);
    client.init(&admin, &stream_contract);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    (env, client, stream_contract, sender, recipient)
}

fn mint_sample(
    env: &Env,
    client: &AttestationContractClient,
    caller: &Address,
    sender: &Address,
    recipient: &Address,
) -> u64 {
    env.mock_all_auths();
    client.mint_attestation(
        caller,
        &7,
        sender,
        recipient,
        &500_000_000,
        &Address::generate(env),
        &Category::Freelance,
        &String::from_str(env, "Design sprint"),
        &10,
        &20,
    )
}

#[test]
#[should_panic]
fn test_mint_only_by_stream_contract() {
    let (env, client, _stream_contract, sender, recipient) = setup();
    client.mint_attestation(
        &sender,
        &1,
        &sender,
        &recipient,
        &100,
        &Address::generate(&env),
        &Category::Bounty,
        &String::from_str(&env, "Unauthorized"),
        &1,
        &2,
    );
}

#[test]
fn test_get_attestation() {
    let (env, client, stream_contract, sender, recipient) = setup();
    let id = mint_sample(&env, &client, &stream_contract, &sender, &recipient);
    let record = client.get_attestation(&id);
    assert_eq!(record.id, id);
    assert_eq!(record.stream_id, 7);
    assert_eq!(record.recipient, recipient);
}

#[test]
fn test_verify_attestation_true() {
    let (env, client, stream_contract, sender, recipient) = setup();
    let id = mint_sample(&env, &client, &stream_contract, &sender, &recipient);
    assert!(client.verify_attestation(&id));
}

#[test]
fn test_verify_attestation_false() {
    let (_env, client, _stream_contract, _sender, _recipient) = setup();
    assert!(!client.verify_attestation(&999));
}