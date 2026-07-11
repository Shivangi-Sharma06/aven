#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, Env, String,
};

fn create_client<'a>(env: &'a Env, attestation_contract: &Address) -> StreamContractClient<'a> {
    let admin = Address::generate(env);
    let contract_id = env.register(StreamContract, ());
    let client = StreamContractClient::new(env, &contract_id);
    client.init(&admin, attestation_contract);
    client
}

fn create_asset(env: &Env, sender: &Address, amount: i128) -> Address {
    let admin = Address::generate(env);
    let asset = env.register_stellar_asset_contract_v2(admin);
    let asset_id = asset.address();
    let asset_client = StellarAssetClient::new(env, &asset_id);
    asset_client.mint(sender, &amount);
    asset_id
}

#[allow(clippy::too_many_arguments)]
fn create_stream(
    env: &Env,
    client: &StreamContractClient,
    sender: &Address,
    recipient: &Address,
    asset: &Address,
    rate: i128,
    deposit: i128,
    duration: u32,
) -> u64 {
    client
        .create_stream(
            sender,
            recipient,
            &rate,
            asset,
            &deposit,
            &duration,
            &Category::Freelance,
            &String::from_str(env, "Frontend work"),
        )
}

#[test]
fn test_create_stream_success() {
    let env = Env::default();
    env.mock_all_auths();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 1_000);
    let client = create_client(&env, &Address::generate(&env));

    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 500, 10);
    let stream = client.get_stream(&id);

    assert_eq!(stream.id, 1);
    assert_eq!(stream.sender, sender);
    assert_eq!(stream.recipient, recipient);
    assert_eq!(stream.total_deposited, 500);
    assert_eq!(stream.rate_per_ledger, 50);
    assert_eq!(stream.status, StreamStatus::Active);
    assert_eq!(client.get_sender_streams(&stream.sender).len(), 1);
    assert_eq!(client.get_recipient_streams(&stream.recipient).len(), 1);
}

#[test]
#[should_panic]
fn test_create_stream_insufficient_deposit() {
    let env = Env::default();
    env.mock_all_auths();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 1_000);
    let client = create_client(&env, &Address::generate(&env));

    create_stream(&env, &client, &sender, &recipient, &asset, 10, 499, 10);
}

#[test]
fn test_withdraw_partial() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 1_000);
    let token = TokenClient::new(&env, &asset);
    let client = create_client(&env, &Address::generate(&env));
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 500, 10);

    env.ledger().set_sequence_number(105);
    client.withdraw(&id, &recipient);

    assert_eq!(token.balance(&recipient), 250);
    assert_eq!(client.get_stream(&id).total_withdrawn, 250);
}

#[test]
fn test_pause_resume() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 1_000);
    let client = create_client(&env, &Address::generate(&env));
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 500, 10);

    env.ledger().set_sequence_number(103);
    client.pause_stream(&id, &sender);
    env.ledger().set_sequence_number(108);
    client.resume_stream(&id, &sender);
    let stream = client.get_stream(&id);

    assert_eq!(stream.paused_duration_ledgers, 5);
    assert_eq!(stream.status, StreamStatus::Active);
}

#[test]
fn test_cancel_returns_unstreamed() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 1_000);
    let token = TokenClient::new(&env, &asset);
    let client = create_client(&env, &Address::generate(&env));
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 500, 10);

    env.ledger().set_sequence_number(102);
    client.cancel_stream(&id, &sender);

    assert_eq!(token.balance(&sender), 900);
    assert_eq!(client.get_stream(&id).status, StreamStatus::Cancelled);
}

#[test]
fn test_cancel_pays_earned_to_recipient() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 1_000);
    let token = TokenClient::new(&env, &asset);
    let client = create_client(&env, &Address::generate(&env));
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 500, 10);

    env.ledger().set_sequence_number(102);
    client.cancel_stream(&id, &sender);

    assert_eq!(token.balance(&recipient), 100);
}

#[test]
#[should_panic]
fn test_only_sender_can_pause() {
    let env = Env::default();
    env.mock_all_auths();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let other = Address::generate(&env);
    let asset = create_asset(&env, &sender, 1_000);
    let client = create_client(&env, &Address::generate(&env));
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 500, 10);

    client.pause_stream(&id, &other);
}

#[test]
#[should_panic]
fn test_only_recipient_can_withdraw() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let other = Address::generate(&env);
    let asset = create_asset(&env, &sender, 1_000);
    let client = create_client(&env, &Address::generate(&env));
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 500, 10);

    env.ledger().set_sequence_number(101);
    client.withdraw(&id, &other);
}

#[test]
#[should_panic]
fn test_overflow_protection() {
    let env = Env::default();
    env.mock_all_auths();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, i128::MAX);
    let client = create_client(&env, &Address::generate(&env));

    create_stream(
        &env,
        &client,
        &sender,
        &recipient,
        &asset,
        i128::MAX,
        i128::MAX,
        u32::MAX,
    );
}