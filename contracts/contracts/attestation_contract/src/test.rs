#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup() -> (
    Env,
    AttestationContractClient<'static>,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    let admin = Address::generate(&env);
    let stream_contract = Address::generate(&env);
    let contract_id = env.register(AttestationContract, ());
    let client = AttestationContractClient::new(&env, &contract_id);
    env.mock_all_auths();
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
        &7, // stream_id
        &0, // checkpoint_index
        sender,
        recipient,
        &500_000_000, // amount_paid
        &Address::generate(env), // asset
        &Category::Freelance,
        &String::from_str(env, "Design sprint"),
        &10, // period_start_ledger
        &20, // period_end_ledger
        &true, // client_confirmed
    )
}

#[test]
fn test_mint_success() {
    let (env, client, stream_contract, sender, recipient) = setup();
    let id = mint_sample(&env, &client, &stream_contract, &sender, &recipient);
    
    let record = client.get_attestation(&id);
    assert_eq!(record.id, id);
    assert_eq!(record.stream_id, 7);
    assert_eq!(record.checkpoint_index, 0);
    assert_eq!(record.sender, sender);
    assert_eq!(record.recipient, recipient);
    assert_eq!(record.amount_paid, 500_000_000);
    assert_eq!(record.category, Category::Freelance);
    assert_eq!(record.period_start_ledger, 10);
    assert_eq!(record.period_end_ledger, 20);
    assert!(record.client_confirmed);
}

#[test]
fn test_mint_only_by_stream_contract() {
    let (env, client, _stream_contract, sender, recipient) = setup();
    let unauthorized_caller = Address::generate(&env);
    
    let res = client.try_mint_attestation(
        &unauthorized_caller,
        &7,
        &0,
        &sender,
        &recipient,
        &500_000_000,
        &Address::generate(&env),
        &Category::Freelance,
        &String::from_str(&env, "Design sprint"),
        &10,
        &20,
        &true,
    );
    assert_eq!(res.unwrap_err().unwrap(), Error::Unauthorized);
}

#[test]
fn test_get_attestation_not_found() {
    let (_env, client, _stream_contract, _sender, _recipient) = setup();
    let res = client.try_get_attestation(&999);
    let err = match res {
        Err(Ok(e)) => e,
        _ => panic!("expected Err(Ok(Error))"),
    };
    assert_eq!(err, Error::AttestationNotFound);
}

#[test]
fn test_verify_attestation() {
    let (env, client, stream_contract, sender, recipient) = setup();
    let id = mint_sample(&env, &client, &stream_contract, &sender, &recipient);
    assert!(client.verify_attestation(&id));
    assert!(!client.verify_attestation(&999));
}

#[test]
fn test_invalid_payment_rejected() {
    let (env, client, stream_contract, sender, recipient) = setup();
    
    let res = client.try_mint_attestation(
        &stream_contract,
        &7,
        &0,
        &sender,
        &recipient,
        &0, // Zero payment is invalid
        &Address::generate(&env),
        &Category::Freelance,
        &String::from_str(&env, "Zero pay"),
        &10,
        &20,
        &true,
    );
    assert_eq!(res.unwrap_err().unwrap(), Error::InvalidPayment);
}

#[test]
fn test_invalid_ledger_range_rejected() {
    let (env, client, stream_contract, sender, recipient) = setup();
    
    let res = client.try_mint_attestation(
        &stream_contract,
        &7,
        &0,
        &sender,
        &recipient,
        &500_000_000,
        &Address::generate(&env),
        &Category::Freelance,
        &String::from_str(&env, "Invalid range"),
        &20, // start > end
        &10,
        &true,
    );
    assert_eq!(res.unwrap_err().unwrap(), Error::InvalidLedgerRange);
}

#[test]
fn test_title_too_long_rejected() {
    let (env, client, stream_contract, sender, recipient) = setup();
    
    // Create an 81-character title
    let rust_string = std::string::String::from("a").repeat(81);
    let long_title = String::from_str(&env, &rust_string);
    
    let res = client.try_mint_attestation(
        &stream_contract,
        &7,
        &0,
        &sender,
        &recipient,
        &500_000_000,
        &Address::generate(&env),
        &Category::Freelance,
        &long_title,
        &10,
        &20,
        &true,
    );
    assert_eq!(res.unwrap_err().unwrap(), Error::TitleTooLong);
}

#[test]
fn test_get_recipient_attestations() {
    let (env, client, stream_contract, sender, recipient) = setup();
    let id1 = mint_sample(&env, &client, &stream_contract, &sender, &recipient);
    
    // Mint another one for the same recipient
    let id2 = client.mint_attestation(
        &stream_contract,
        &8,
        &1,
        &sender,
        &recipient,
        &100_000_000,
        &Address::generate(&env),
        &Category::Salary,
        &String::from_str(&env, "Second attestation"),
        &30,
        &40,
        &true,
    );
    
    let attestations = client.get_recipient_attestations(&recipient);
    assert_eq!(attestations.len(), 2);
    assert_eq!(attestations.get(0).unwrap(), id1);
    assert_eq!(attestations.get(1).unwrap(), id2);
}
