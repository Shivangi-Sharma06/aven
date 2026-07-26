#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env, String,
};

#[contract]
struct MockAttestationContract;

#[contractimpl]
impl MockAttestationContract {
    #[allow(clippy::too_many_arguments)]
    pub fn mint_attestation(
        _env: Env,
        caller: Address,
        _kind: AttestationKind,
        stream_id: u64,
        _request_id: String,
        _checkpoint_index: u32,
        _sender: Address,
        _recipient: Address,
        amount_paid: i128,
        _asset: Address,
        _category: Category,
        _title: String,
        _period_start_ledger: u32,
        _period_end_ledger: u32,
        _active_duration_seconds: u64,
        _client_confirmed: bool,
        _auto_released: bool,
        _report_hash: Option<BytesN<32>>,
    ) -> u64 {
        caller.require_auth();
        if amount_paid <= 0 {
            panic!("invalid payment");
        }
        stream_id
    }
}

fn create_asset(env: &Env, sender: &Address, amount: i128) -> Address {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let asset = env.register_stellar_asset_contract_v2(admin);
    let asset_id = asset.address();
    StellarAssetClient::new(env, &asset_id).mint(sender, &amount);
    asset_id
}

fn setup_no_verifier(env: &Env) -> (StreamContractClient<'_>, Address, Address) {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let attestation = env.register(MockAttestationContract, ());
    let contract_id = env.register(StreamContract, ());
    let client = StreamContractClient::new(env, &contract_id);
    client.init(&admin, &attestation);
    (client, admin, attestation)
}

fn create_stream(
    env: &Env,
    client: &StreamContractClient,
    sender: &Address,
    recipient: &Address,
    asset: &Address,
    rate_per_second: i128,
    deposit: i128,
    duration_ledgers: u32,
) -> u64 {
    client.create_stream(
        sender,
        recipient,
        &rate_per_second,
        asset,
        &deposit,
        &duration_ledgers,
        &4,
        &60,
        &50,
        &Category::Freelance,
        &String::from_str(env, "Design sprint"),
    )
}

fn request(
    env: &Env,
    client: &StreamContractClient,
    id: u64,
    recipient: &Address,
    request_id: &str,
    amount: i128,
) {
    // Mock all auths so the test can call request_withdrawal directly
    // (normally the recipient signs).
    client.request_withdrawal(
        &id,
        recipient,
        &String::from_str(env, request_id),
        &amount,
    );
}

#[test]
fn stream_creation_rejects_self_payment_and_keeps_legacy_fields_inert() {
    let env = Env::default();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 100_000);
    let (client, _, _) = setup_no_verifier(&env);

    let same_wallet = client.try_create_stream(
        &sender,
        &sender,
        &10,
        &asset,
        &20_000,
        &400,
        &4,
        &60,
        &50,
        &Category::Freelance,
        &String::from_str(&env, "Invalid"),
    );
    assert_eq!(
        same_wallet.unwrap_err().unwrap(),
        Error::SenderMatchesRecipient
    );

    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 20_000, 400);
    let stream = client.get_stream(&id);
    assert_eq!(stream.rate_per_ledger, 50);
    assert_eq!(stream.checkpoint_count, 0);
    assert_eq!(stream.checkpoint_span_ledgers, 0);
    assert_eq!(stream.withdrawable_cap_percent, 0);
    assert_eq!(client.compute_available(&id), 20_000);
}

#[test]
fn ledger_time_does_not_increase_available_or_measured_value() {
    let env = Env::default();
    env.ledger().set_sequence_number(100);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 100_000);
    let (client, _, _) = setup_no_verifier(&env);
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 20_000, 400);

    assert_eq!(client.compute_available(&id), 20_000);
    assert_eq!(client.compute_earned(&id), 0);
    env.ledger().set_sequence_number(50_000);
    assert_eq!(client.compute_available(&id), 20_000);
    assert_eq!(client.compute_earned(&id), 0);
}

#[test]
fn request_withdrawal_reserves_escrow_and_requires_approval() {
    let env = Env::default();
    env.mock_all_auths();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 100_000);
    let token = TokenClient::new(&env, &asset);
    let (client, _, _) = setup_no_verifier(&env);
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 20_000, 400);
    let request_id = String::from_str(&env, "session-request");

    // Recipient requests a withdrawal directly (no verifier needed)
    request(&env, &client, id, &recipient, "session-request", 1_000);
    assert_eq!(client.compute_earned(&id), 1_000);
    assert_eq!(client.compute_available(&id), 19_000);

    // Cannot withdraw without approval
    assert_eq!(
        client
            .try_withdraw_approved(&id, &recipient, &request_id)
            .unwrap_err()
            .unwrap(),
        Error::WithdrawalNotApproved
    );

    // Sender approves
    client.approve_withdrawal(&id, &sender, &request_id);

    // Now the recipient can withdraw
    assert_eq!(client.withdraw_approved(&id, &recipient, &request_id), 1_000);
    assert_eq!(token.balance(&recipient), 1_000);
    assert_eq!(client.compute_earned(&id), 1_000);
    assert_eq!(client.compute_available(&id), 19_000);
}

#[test]
fn dispute_frees_capacity_and_pending_claim_blocks_cancel() {
    let env = Env::default();
    env.mock_all_auths();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 100_000);
    let token = TokenClient::new(&env, &asset);
    let (client, _, _) = setup_no_verifier(&env);
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 20_000, 400);
    let request_id = String::from_str(&env, "session-dispute");

    request(&env, &client, id, &recipient, "session-dispute", 500);
    assert_eq!(
        client
            .try_cancel_stream(&id, &sender)
            .unwrap_err()
            .unwrap(),
        Error::OutstandingWithdrawals
    );
    client.dispute_withdrawal(&id, &sender, &request_id);
    assert_eq!(client.compute_available(&id), 20_000);
    client.cancel_stream(&id, &sender);
    assert_eq!(token.balance(&sender), 100_000);
    assert_eq!(token.balance(&recipient), 0);
}

#[test]
fn full_escrow_release_completes_stream() {
    let env = Env::default();
    env.mock_all_auths();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 100_000);
    let (client, _, _) = setup_no_verifier(&env);
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 20_000, 400);
    let request_id = String::from_str(&env, "session-complete");

    request(&env, &client, id, &recipient, "session-complete", 20_000);
    client.approve_withdrawal(&id, &sender, &request_id);
    client.withdraw_approved(&id, &recipient, &request_id);

    assert_eq!(client.get_stream(&id).status, StreamStatus::Completed);
    assert_eq!(client.compute_available(&id), 0);
    assert_eq!(client.compute_earned(&id), 20_000);
}

#[test]
fn legacy_request_withdrawal_works_without_verifier() {
    let env = Env::default();
    env.mock_all_auths();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 100_000);
    let (client, _, _) = setup_no_verifier(&env);
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 20_000, 400);

    // This should succeed — no verifier is configured, so the legacy path is open.
    let result = client.try_request_withdrawal(
        &id,
        &recipient,
        &String::from_str(&env, "legacy-request"),
        &500,
    );
    assert!(result.is_ok());
    assert_eq!(client.compute_earned(&id), 500);
}