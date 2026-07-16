#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env, String,
};
use stream_contract::{StreamContract, StreamContractClient};

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
        stream_id * 1000 + checkpoint_index as u64 + 1
    }
}

struct Fixture {
    env: Env,
    owner: Address,
    agent: Address,
    recipient: Address,
    asset: Address,
    mandate_id: Address,
    mandate: AgentMandateContractClient<'static>,
    stream: StreamContractClient<'static>,
}

fn policy(env: &Env) -> MandatePolicy {
    MandatePolicy {
        per_stream_limit: 50_000,
        window_limit: 80_000,
        window_ledgers: 1_000,
        max_duration_ledgers: 1_000,
        max_checkpoint_count: 10,
        human_approval_threshold: 25_000,
        expires_at_ledger: env.ledger().sequence() + 10_000,
        enforce_recipient_allowlist: true,
        agent_can_approve_checkpoints: true,
    }
}

fn params(env: &Env, recipient: &Address, asset: &Address, deposit: i128) -> StreamParams {
    StreamParams {
        recipient: recipient.clone(),
        asset: asset.clone(),
        total_deposited: deposit,
        rate_per_second: 10,
        duration_ledgers: 400,
        checkpoint_count: 4,
        withdrawable_cap_percent: 60,
        approval_timeout_ledgers: 50,
        category: Category::AgentTask,
        title: String::from_str(env, "Agent research task"),
    }
}

fn request(env: &Env, value: u8) -> BytesN<32> {
    BytesN::from_array(env, &[value; 32])
}

fn fixture() -> Fixture {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);
    let owner = Address::generate(&env);
    let agent = Address::generate(&env);
    let recipient = Address::generate(&env);

    let attestation_id = env.register(MockAttestationContract, ());
    let stream_id = env.register(StreamContract, ());
    let stream = StreamContractClient::new(&env, &stream_id);
    stream.init(&Address::generate(&env), &attestation_id);

    let asset_admin = Address::generate(&env);
    let asset_registration = env.register_stellar_asset_contract_v2(asset_admin);
    let asset = asset_registration.address();
    StellarAssetClient::new(&env, &asset).mint(&owner, &200_000);

    let assets = Vec::from_array(&env, [asset.clone()]);
    let mandate_id = env.register(
        AgentMandateContract,
        (
            owner.clone(),
            agent.clone(),
            stream_id,
            assets,
            policy(&env),
        ),
    );
    let mandate = AgentMandateContractClient::new(&env, &mandate_id);
    mandate.set_recipient(&owner, &recipient, &true);
    mandate.deposit(&owner, &asset, &100_000);

    Fixture {
        env,
        owner,
        agent,
        recipient,
        asset,
        mandate_id,
        mandate,
        stream,
    }
}

#[test]
fn executes_low_value_stream_through_existing_contract() {
    let f = fixture();
    let stream_id = f.mandate.execute_stream(
        &f.agent,
        &request(&f.env, 1),
        &params(&f.env, &f.recipient, &f.asset, 20_000),
    );
    let stream = f.stream.get_stream(&stream_id);
    assert_eq!(stream.sender, f.mandate_id);
    assert_eq!(stream.recipient, f.recipient);
    assert_eq!(stream.category, Category::AgentTask);
    assert_eq!(stream.total_deposited, 20_000);
    assert_eq!(f.mandate.get_spend_window().spent, 20_000);
    assert_eq!(f.mandate.get_balance(&f.asset), 80_000);
}

#[test]
fn high_value_stream_requires_owner_proposal_approval() {
    let f = fixture();
    let high = params(&f.env, &f.recipient, &f.asset, 25_000);
    let direct = f
        .mandate
        .try_execute_stream(&f.agent, &request(&f.env, 2), &high);
    assert_eq!(direct.unwrap_err().unwrap(), Error::OwnerApprovalRequired);

    let proposal_id = f
        .mandate
        .propose_stream(&f.agent, &request(&f.env, 3), &high);
    let stream_id = f.mandate.approve_and_execute(&f.owner, &proposal_id);
    assert_eq!(f.stream.get_stream(&stream_id).total_deposited, 25_000);
    assert_eq!(
        f.mandate.get_proposal(&proposal_id).status,
        ProposalStatus::Executed
    );
}

#[test]
fn duplicate_request_is_rejected() {
    let f = fixture();
    let id = request(&f.env, 4);
    let input = params(&f.env, &f.recipient, &f.asset, 20_000);
    f.mandate.execute_stream(&f.agent, &id, &input);
    let duplicate = f.mandate.try_execute_stream(&f.agent, &id, &input);
    assert_eq!(duplicate.unwrap_err().unwrap(), Error::DuplicateRequest);
}

#[test]
fn enforces_recipient_asset_and_window_limits() {
    let f = fixture();
    let other = Address::generate(&f.env);
    let bad_recipient = params(&f.env, &other, &f.asset, 20_000);
    let result = f
        .mandate
        .try_execute_stream(&f.agent, &request(&f.env, 5), &bad_recipient);
    assert_eq!(result.unwrap_err().unwrap(), Error::RecipientNotAllowed);

    let bad_asset = f
        .env
        .register_stellar_asset_contract_v2(Address::generate(&f.env))
        .address();
    let disallowed = params(&f.env, &f.recipient, &bad_asset, 20_000);
    let result = f
        .mandate
        .try_execute_stream(&f.agent, &request(&f.env, 6), &disallowed);
    assert_eq!(result.unwrap_err().unwrap(), Error::AssetNotAllowed);

    f.mandate.execute_stream(
        &f.agent,
        &request(&f.env, 7),
        &params(&f.env, &f.recipient, &f.asset, 20_000),
    );
    f.mandate.execute_stream(
        &f.agent,
        &request(&f.env, 8),
        &params(&f.env, &f.recipient, &f.asset, 20_000),
    );
    let result = f.mandate.try_approve_and_execute(
        &f.owner,
        &f.mandate.propose_stream(
            &f.agent,
            &request(&f.env, 9),
            &params(&f.env, &f.recipient, &f.asset, 50_000),
        ),
    );
    assert_eq!(result.unwrap_err().unwrap(), Error::WindowLimitExceeded);
}

#[test]
fn pause_revoke_and_expiry_stop_execution_but_owner_can_recover() {
    let f = fixture();
    f.mandate.pause(&f.owner);
    let result = f.mandate.try_execute_stream(
        &f.agent,
        &request(&f.env, 10),
        &params(&f.env, &f.recipient, &f.asset, 20_000),
    );
    assert_eq!(result.unwrap_err().unwrap(), Error::MandatePaused);
    f.mandate.resume(&f.owner);
    f.mandate.revoke(&f.owner);
    let result = f.mandate.try_execute_stream(
        &f.agent,
        &request(&f.env, 11),
        &params(&f.env, &f.recipient, &f.asset, 20_000),
    );
    assert_eq!(result.unwrap_err().unwrap(), Error::MandateRevoked);

    f.mandate
        .withdraw_unused(&f.owner, &f.asset, &100_000, &f.owner);
    assert_eq!(
        TokenClient::new(&f.env, &f.asset).balance(&f.owner),
        200_000
    );
}

#[test]
fn managed_checkpoint_can_be_approved_by_agent() {
    let f = fixture();
    let stream_id = f.mandate.execute_stream(
        &f.agent,
        &request(&f.env, 12),
        &params(&f.env, &f.recipient, &f.asset, 20_000),
    );
    f.stream.submit_checkpoint(
        &stream_id,
        &f.recipient,
        &0,
        &BytesN::from_array(&f.env, &[9; 32]),
    );
    let attestation_id = f.mandate.approve_checkpoint(&f.agent, &stream_id, &0);
    assert_eq!(attestation_id, stream_id * 1000 + 1);
}

#[test]
fn failed_execution_rolls_back_request_and_spend_accounting() {
    let f = fixture();
    f.mandate
        .withdraw_unused(&f.owner, &f.asset, &90_000, &f.owner);
    let id = request(&f.env, 13);
    let result = f.mandate.try_execute_stream(
        &f.agent,
        &id,
        &params(&f.env, &f.recipient, &f.asset, 20_000),
    );
    assert_eq!(
        result.unwrap_err().unwrap(),
        Error::InsufficientMandateBalance
    );
    assert!(!f.mandate.is_request_used(&id));
    assert_eq!(f.mandate.get_spend_window().spent, 0);
}

#[test]
fn owner_can_reject_but_not_reexecute_a_proposal() {
    let f = fixture();
    let proposal_id = f.mandate.propose_stream(
        &f.agent,
        &request(&f.env, 14),
        &params(&f.env, &f.recipient, &f.asset, 30_000),
    );
    f.mandate.reject_proposal(&f.owner, &proposal_id);
    assert_eq!(
        f.mandate.get_proposal(&proposal_id).status,
        ProposalStatus::Rejected
    );
    let result = f.mandate.try_approve_and_execute(&f.owner, &proposal_id);
    assert_eq!(result.unwrap_err().unwrap(), Error::ProposalNotPending);
}

#[test]
fn expiry_and_checkpoint_policy_are_enforced() {
    let f = fixture();
    let mut updated = policy(&f.env);
    updated.agent_can_approve_checkpoints = false;
    f.mandate.update_policy(&f.owner, &updated);

    let stream_id = f.mandate.execute_stream(
        &f.agent,
        &request(&f.env, 15),
        &params(&f.env, &f.recipient, &f.asset, 20_000),
    );
    f.stream.submit_checkpoint(
        &stream_id,
        &f.recipient,
        &0,
        &BytesN::from_array(&f.env, &[7; 32]),
    );
    let result = f.mandate.try_approve_checkpoint(&f.agent, &stream_id, &0);
    assert_eq!(result.unwrap_err().unwrap(), Error::NotAuthorized);
    f.mandate.approve_checkpoint(&f.owner, &stream_id, &0);

    f.env
        .ledger()
        .set_sequence_number(updated.expires_at_ledger);
    let result = f.mandate.try_execute_stream(
        &f.agent,
        &request(&f.env, 16),
        &params(&f.env, &f.recipient, &f.asset, 20_000),
    );
    assert_eq!(result.unwrap_err().unwrap(), Error::MandateExpired);
}

#[test]
fn owner_can_settle_an_existing_stream_after_revocation() {
    let f = fixture();
    let stream_id = f.mandate.execute_stream(
        &f.agent,
        &request(&f.env, 17),
        &params(&f.env, &f.recipient, &f.asset, 20_000),
    );
    f.stream.submit_checkpoint(
        &stream_id,
        &f.recipient,
        &0,
        &BytesN::from_array(&f.env, &[8; 32]),
    );
    f.mandate.revoke(&f.owner);

    let attestation_id = f.mandate.approve_checkpoint(&f.owner, &stream_id, &0);
    assert_eq!(attestation_id, stream_id * 1000 + 1);
}
