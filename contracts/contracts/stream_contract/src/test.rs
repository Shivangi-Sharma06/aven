#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, Env, String, BytesN,
};

fn create_client<'a>(env: &'a Env, attestation_contract: &Address) -> StreamContractClient<'a> {
    let admin = Address::generate(env);
    let contract_id = env.register(StreamContract, ());
    let client = StreamContractClient::new(env, &contract_id);
    client.init(&admin, attestation_contract);
    client
}

#[contract]
struct MockAttestationContract;

#[contractimpl]
impl MockAttestationContract {
    #[allow(clippy::too_many_arguments)]
    pub fn mint_attestation(
        _env: Env,
        caller: Address,
        stream_id: u64,
        checkpoint_index: u32,
        _sender: Address,
        _recipient: Address,
        amount_paid: i128,
        _asset: Address,
        _category: Category,
        _title: String,
        _period_start_ledger: u32,
        _period_end_ledger: u32,
        _client_confirmed: bool,
    ) -> u64 {
        caller.require_auth();
        if amount_paid <= 0 {
            panic!("invalid payment");
        }
        stream_id * 1000 + (checkpoint_index as u64) + 1
    }
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
    checkpoint_count: u32,
    withdrawable_cap_percent: u32,
    approval_timeout_ledgers: u32,
) -> u64 {
    client.create_stream(
        sender,
        recipient,
        &rate,
        asset,
        &deposit,
        &duration,
        &checkpoint_count,
        &withdrawable_cap_percent,
        &approval_timeout_ledgers,
        &Category::Freelance,
        &String::from_str(env, "Design sprint"),
    )
}

fn approved_withdrawal(
    env: &Env,
    client: &StreamContractClient,
    stream_id: u64,
    sender: &Address,
    recipient: &Address,
    request_id: &str,
    amount: i128,
) -> i128 {
    let request_id = String::from_str(env, request_id);
    client.request_withdrawal(&stream_id, recipient, &request_id, &amount);
    client.approve_withdrawal(&stream_id, sender, &request_id);
    client.withdraw_approved(&stream_id, recipient, &request_id)
}

#[test]
fn test_create_stream_success() {
    let env = Env::default();
    env.mock_all_auths();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 100_000);
    let client = create_client(&env, &Address::generate(&env));

    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 20_000, 400, 4, 60, 50);
    let stream = client.get_stream(&id);

    assert_eq!(stream.id, id);
    assert_eq!(stream.sender, sender);
    assert_eq!(stream.recipient, recipient);
    assert_eq!(stream.total_deposited, 20_000);
    assert_eq!(stream.rate_per_ledger, 50); // 10 * 5 = 50
    assert_eq!(stream.status, StreamStatus::Active);
    assert_eq!(stream.checkpoint_count, 4);
    assert_eq!(stream.checkpoint_span_ledgers, 100);
    assert_eq!(stream.withdrawable_cap_percent, 60);
    assert_eq!(stream.approval_timeout_ledgers, 50);
}

#[test]
fn test_create_stream_insufficient_deposit() {
    let env = Env::default();
    env.mock_all_auths();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 100_000);
    let client = create_client(&env, &Address::generate(&env));

    // requires 50 * 400 = 20,000 deposit, we supply 19,999
    let res = client.try_create_stream(
        &sender,
        &recipient,
        &10,
        &asset,
        &19_999,
        &400,
        &4,
        &60,
        &50,
        &Category::Freelance,
        &String::from_str(&env, "Design sprint"),
    );
    assert_eq!(res.unwrap_err().unwrap(), Error::InsufficientDeposit);
}

#[test]
fn test_withdraw_partial() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 100_000);
    let token = TokenClient::new(&env, &asset);
    let client = create_client(&env, &Address::generate(&env));
    
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 20_000, 400, 4, 60, 50);

    // Advance sequence number to 150 (elapsed: 50 ledgers)
    env.ledger().set_sequence_number(150);
    
    let earned = client.compute_earned(&id);
    assert_eq!(earned, 1500); // 50 * 50 = 2500, capped at 60% = 1500
    
    let withdrawn = approved_withdrawal(&env, &client, id, &sender, &recipient, "session-1", 1500);
    assert_eq!(withdrawn, 1500);
    assert_eq!(token.balance(&recipient), 1500);
    assert_eq!(client.get_stream(&id).total_withdrawn, 1500);
}

#[test]
fn test_submit_and_approve_checkpoint() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let mock_attestation = env.register(MockAttestationContract, ());
    let asset = create_asset(&env, &sender, 100_000);
    let token = TokenClient::new(&env, &asset);
    let client = create_client(&env, &mock_attestation);
    
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 20_000, 400, 4, 60, 50);

    // Sequence to 200 (end of checkpoint 1 span)
    env.ledger().set_sequence_number(200);
    
    // Earned: 100 * 50 = 5000. Unlocked before approval: 5000 * 60% = 3000
    let withdrawn1 = approved_withdrawal(&env, &client, id, &sender, &recipient, "session-1", 3000);
    assert_eq!(withdrawn1, 3000);
    
    // Submit checkpoint 1 (index 0)
    let evidence_hash = BytesN::from_array(&env, &[1u8; 32]);
    client.submit_checkpoint(&id, &recipient, &0, &evidence_hash);
    
    // Approve checkpoint 1
    let attestation_id = client.approve_checkpoint(&id, &sender, &0);
    assert_eq!(attestation_id, 1001);
    
    // Checkpoint record should show approved = true, attestation_id = 1001
    let cp = client.get_checkpoint(&id, &0);
    assert!(cp.approved);
    assert!(!cp.auto_approved);
    assert_eq!(cp.attestation_id, 1001);
    
    // After approval, the remaining 2000 is withdrawable
    let withdrawn2 = approved_withdrawal(&env, &client, id, &sender, &recipient, "session-2", 2000);
    assert_eq!(withdrawn2, 2000);
    assert_eq!(token.balance(&recipient), 5000);
}

#[test]
fn test_checkpoint_auto_approve_timeout() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let mock_attestation = env.register(MockAttestationContract, ());
    let asset = create_asset(&env, &sender, 100_000);
    let client = create_client(&env, &mock_attestation);
    
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 20_000, 400, 4, 60, 50);

    // Sequence to 250 (due at 200 + 50 timeout = 250)
    env.ledger().set_sequence_number(250);
    
    // Withdraw should trigger auto-approval of checkpoint 1
    // Total earned: 150 * 50 = 7500 (100 * 50 for checkpoint 1, plus 50 * 50 for in-progress checkpoint 2).
    // Checkpoint 1: fully unlocked (5000)
    // Checkpoint 2: partial capped (50 * 50 * 60% = 1500)
    // Total withdrawable: 5000 + 1500 = 6500.
    let request_id = String::from_str(&env, "session-timeout");
    client.request_withdrawal(&id, &recipient, &request_id, &6500);
    env.ledger().set_sequence_number(300);
    let withdrawn = client.withdraw_approved(&id, &recipient, &request_id);
    assert_eq!(withdrawn, 6500);
    
    let cp = client.get_checkpoint(&id, &0);
    assert!(!cp.approved);
    assert!(cp.auto_approved);
    assert_eq!(cp.attestation_id, 1001);
}

#[test]
fn test_pause_resume() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 100_000);
    let client = create_client(&env, &Address::generate(&env));
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 20_000, 400, 4, 60, 50);

    env.ledger().set_sequence_number(130);
    client.pause_stream(&id, &sender);
    env.ledger().set_sequence_number(180);
    client.resume_stream(&id, &sender);
    let stream = client.get_stream(&id);

    assert_eq!(stream.paused_duration_ledgers, 50);
    assert_eq!(stream.status, StreamStatus::Active);
}

#[test]
fn test_cancel_stream_refunds() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 100_000);
    let token = TokenClient::new(&env, &asset);
    let client = create_client(&env, &Address::generate(&env));
    
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 20_000, 400, 4, 60, 50);

    // Advance sequence number to 150
    env.ledger().set_sequence_number(150);
    
    client.cancel_stream(&id, &sender);
    
    // Recipient should receive 1500 (the withdrawable portion)
    assert_eq!(token.balance(&recipient), 1500);
    // Sender should get refunded the remainder (initial 100_000 - 20_000 deposit + 18_500 refund = 98_500)
    assert_eq!(token.balance(&sender), 98_500);
    
    let stream = client.get_stream(&id);
    assert_eq!(stream.status, StreamStatus::Cancelled);
    assert_eq!(stream.total_withdrawn, 1500);
}

#[test]
fn test_only_sender_can_pause() {
    let env = Env::default();
    env.mock_all_auths();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let other = Address::generate(&env);
    let asset = create_asset(&env, &sender, 100_000);
    let client = create_client(&env, &Address::generate(&env));
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 20_000, 400, 4, 60, 50);

    let res = client.try_pause_stream(&id, &other);
    assert_eq!(res.unwrap_err().unwrap(), Error::NotSender);
}

#[test]
fn test_only_recipient_can_withdraw() {
    let env = Env::default();
    env.mock_all_auths();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let other = Address::generate(&env);
    let asset = create_asset(&env, &sender, 100_000);
    let client = create_client(&env, &Address::generate(&env));
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 20_000, 400, 4, 60, 50);

    let res = client.try_withdraw(&id, &other);
    assert_eq!(res.unwrap_err().unwrap(), Error::NotRecipient);
}

#[test]
fn test_exact_withdrawal_requires_approval_and_cannot_repeat() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 100_000);
    let token = TokenClient::new(&env, &asset);
    let client = create_client(&env, &Address::generate(&env));
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 20_000, 400, 4, 60, 50);
    env.ledger().set_sequence_number(150);

    let request_id = String::from_str(&env, "session-exact");
    client.request_withdrawal(&id, &recipient, &request_id, &1000);
    assert_eq!(client.compute_available(&id), 500);
    assert_eq!(
        client.try_withdraw_approved(&id, &recipient, &request_id).unwrap_err().unwrap(),
        Error::WithdrawalNotApproved
    );
    client.approve_withdrawal(&id, &sender, &request_id);
    assert_eq!(client.withdraw_approved(&id, &recipient, &request_id), 1000);
    assert_eq!(token.balance(&recipient), 1000);
    assert_eq!(client.compute_earned(&id), 500);
    assert_eq!(
        client.try_withdraw_approved(&id, &recipient, &request_id).unwrap_err().unwrap(),
        Error::NothingToWithdraw
    );
}

#[test]
fn test_request_validation_and_reservation() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let other = Address::generate(&env);
    let asset = create_asset(&env, &sender, 100_000);
    let client = create_client(&env, &Address::generate(&env));
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 20_000, 400, 4, 60, 50);
    env.ledger().set_sequence_number(150);
    let request_id = String::from_str(&env, "session-validation");

    assert_eq!(
        client.try_request_withdrawal(&id, &recipient, &request_id, &0).unwrap_err().unwrap(),
        Error::InvalidAmount
    );
    assert_eq!(
        client.try_request_withdrawal(&id, &recipient, &request_id, &1501).unwrap_err().unwrap(),
        Error::AmountExceedsWithdrawable
    );
    assert_eq!(
        client.try_request_withdrawal(&id, &other, &request_id, &1).unwrap_err().unwrap(),
        Error::NotRecipient
    );
    client.request_withdrawal(&id, &recipient, &request_id, &1000);
    let second = String::from_str(&env, "session-second");
    assert_eq!(
        client.try_request_withdrawal(&id, &recipient, &second, &501).unwrap_err().unwrap(),
        Error::AmountExceedsWithdrawable
    );
}

#[test]
fn test_dispute_blocks_release_and_frees_reservation() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let other = Address::generate(&env);
    let asset = create_asset(&env, &sender, 100_000);
    let client = create_client(&env, &Address::generate(&env));
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 20_000, 400, 4, 60, 50);
    env.ledger().set_sequence_number(150);
    let request_id = String::from_str(&env, "session-disputed");
    client.request_withdrawal(&id, &recipient, &request_id, &1000);
    assert_eq!(
        client.try_dispute_withdrawal(&id, &other, &request_id).unwrap_err().unwrap(),
        Error::NotSender
    );
    client.dispute_withdrawal(&id, &sender, &request_id);
    assert_eq!(client.compute_available(&id), 1500);
    assert_eq!(
        client.try_withdraw_approved(&id, &recipient, &request_id).unwrap_err().unwrap(),
        Error::WithdrawalDisputed
    );
}

#[test]
fn test_legacy_unreviewed_withdrawal_is_blocked() {
    let env = Env::default();
    env.mock_all_auths();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 100_000);
    let client = create_client(&env, &Address::generate(&env));
    let id = create_stream(&env, &client, &sender, &recipient, &asset, 10, 20_000, 400, 4, 60, 50);
    assert_eq!(
        client.try_withdraw(&id, &recipient).unwrap_err().unwrap(),
        Error::WithdrawalApprovalRequired
    );
}

#[test]
fn test_validation_rules() {
    let env = Env::default();
    env.mock_all_auths();
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let asset = create_asset(&env, &sender, 100_000);
    let client = create_client(&env, &Address::generate(&env));

    // 1. Invalid rate
    let res = client.try_create_stream(&sender, &recipient, &0, &asset, &20_000, &400, &4, &60, &50, &Category::Freelance, &String::from_str(&env, "a"));
    assert_eq!(res.unwrap_err().unwrap(), Error::InvalidRate);

    // 2. Invalid deposit
    let res = client.try_create_stream(&sender, &recipient, &10, &asset, &0, &20_000, &4, &60, &50, &Category::Freelance, &String::from_str(&env, "a"));
    assert_eq!(res.unwrap_err().unwrap(), Error::InvalidDeposit);

    // 3. Invalid duration
    let res = client.try_create_stream(&sender, &recipient, &10, &asset, &20_000, &0, &4, &60, &50, &Category::Freelance, &String::from_str(&env, "a"));
    assert_eq!(res.unwrap_err().unwrap(), Error::InvalidDuration);

    // 4. Invalid checkpoint count
    let res = client.try_create_stream(&sender, &recipient, &10, &asset, &20_000, &400, &0, &60, &50, &Category::Freelance, &String::from_str(&env, "a"));
    assert_eq!(res.unwrap_err().unwrap(), Error::InvalidCheckpointCount);

    // 5. Duration not divisible
    let res = client.try_create_stream(&sender, &recipient, &10, &asset, &20_000, &400, &3, &60, &50, &Category::Freelance, &String::from_str(&env, "a"));
    assert_eq!(res.unwrap_err().unwrap(), Error::DurationNotDivisible);

    // 6. Invalid cap percent
    let res = client.try_create_stream(&sender, &recipient, &10, &asset, &20_000, &400, &4, &101, &50, &Category::Freelance, &String::from_str(&env, "a"));
    assert_eq!(res.unwrap_err().unwrap(), Error::InvalidCapPercent);

    // 7. Invalid timeout
    let res = client.try_create_stream(&sender, &recipient, &10, &asset, &20_000, &400, &4, &60, &0, &Category::Freelance, &String::from_str(&env, "a"));
    assert_eq!(res.unwrap_err().unwrap(), Error::InvalidTimeout);

    // 8. Title too long
    let rust_string = std::string::String::from("a").repeat(81);
    let long_title = String::from_str(&env, &rust_string);
    let res = client.try_create_stream(&sender, &recipient, &10, &asset, &20_000, &400, &4, &60, &50, &Category::Freelance, &long_title);
    assert_eq!(res.unwrap_err().unwrap(), Error::TitleTooLong);
}
