extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env, String,
};

struct Setup {
    env: Env,
    contract_id: Address,
    owner: Address,
    worker: Address,
    verifier: Address,
    arbitrator: Address,
    asset: Address,
}

impl Setup {
    fn client(&self) -> WorkStreamContractClient<'_> {
        WorkStreamContractClient::new(&self.env, &self.contract_id)
    }
}

fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);
    let owner = Address::generate(&env);
    let worker = Address::generate(&env);
    let verifier = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let asset_admin = Address::generate(&env);
    let asset = env
        .register_stellar_asset_contract_v2(asset_admin)
        .address();
    StellarAssetClient::new(&env, &asset).mint(&owner, &100_000);
    let contract_id = env.register(
        WorkStreamContract,
        (owner.clone(), verifier.clone(), arbitrator.clone()),
    );
    Setup {
        env,
        contract_id,
        owner,
        worker,
        verifier,
        arbitrator,
        asset,
    }
}

fn create_stream(setup: &Setup) -> u64 {
    setup.client().create_stream(
        &setup.owner,
        &setup.worker,
        &setup.asset,
        &20_000,
        &10,
        &400,
        &20,
        &String::from_str(&setup.env, "Password reset work"),
    )
}

fn verify(setup: &Setup, stream_id: u64, session: &str, amount: i128) {
    let _ = &setup.verifier;
    setup.client().verify_work(
        &stream_id,
        &String::from_str(&setup.env, session),
        &amount,
        &BytesN::from_array(&setup.env, &[7; 32]),
    );
}

#[test]
fn approved_work_is_paid_exactly_once() {
    let setup = setup();
    let id = create_stream(&setup);
    setup.env.ledger().set_sequence_number(120);
    verify(&setup, id, "day-one", 1_000);
    setup
        .client()
        .approve_claim(&id, &String::from_str(&setup.env, "day-one"), &setup.owner);

    let amount =
        setup
            .client()
            .withdraw(&id, &String::from_str(&setup.env, "day-one"), &setup.worker);
    assert_eq!(amount, 1_000);
    assert_eq!(
        TokenClient::new(&setup.env, &setup.asset).balance(&setup.worker),
        1_000
    );

    let second =
        setup
            .client()
            .try_withdraw(&id, &String::from_str(&setup.env, "day-one"), &setup.worker);
    assert_eq!(second.unwrap_err().unwrap(), Error::WrongStatus);
}

#[test]
fn worker_waits_for_review_window() {
    let setup = setup();
    let id = create_stream(&setup);
    setup.env.ledger().set_sequence_number(120);
    verify(&setup, id, "day-one", 1_000);

    let early =
        setup
            .client()
            .try_withdraw(&id, &String::from_str(&setup.env, "day-one"), &setup.worker);
    assert_eq!(early.unwrap_err().unwrap(), Error::ReviewStillOpen);

    setup.env.ledger().set_sequence_number(140);
    assert_eq!(
        setup
            .client()
            .withdraw(&id, &String::from_str(&setup.env, "day-one"), &setup.worker,),
        1_000
    );
}

#[test]
fn verifier_cannot_reserve_more_than_was_earned() {
    let setup = setup();
    let id = create_stream(&setup);
    setup.env.ledger().set_sequence_number(110);
    let result = setup.client().try_verify_work(
        &id,
        &String::from_str(&setup.env, "too-much"),
        &501,
        &BytesN::from_array(&setup.env, &[1; 32]),
    );
    assert_eq!(result.unwrap_err().unwrap(), Error::AmountNotEarned);
}

#[test]
fn dispute_requires_arbitration() {
    let setup = setup();
    let id = create_stream(&setup);
    setup.env.ledger().set_sequence_number(120);
    verify(&setup, id, "day-one", 1_000);
    setup
        .client()
        .dispute_claim(&id, &String::from_str(&setup.env, "day-one"), &setup.owner);

    setup.env.ledger().set_sequence_number(200);
    let blocked =
        setup
            .client()
            .try_withdraw(&id, &String::from_str(&setup.env, "day-one"), &setup.worker);
    assert_eq!(blocked.unwrap_err().unwrap(), Error::ClaimDisputed);

    setup.client().resolve_dispute(
        &id,
        &String::from_str(&setup.env, "day-one"),
        &true,
        &setup.arbitrator,
    );
    assert_eq!(
        setup
            .client()
            .withdraw(&id, &String::from_str(&setup.env, "day-one"), &setup.worker,),
        1_000
    );
}

#[test]
fn rejected_claim_returns_reserved_capacity() {
    let setup = setup();
    let id = create_stream(&setup);
    setup.env.ledger().set_sequence_number(120);
    verify(&setup, id, "rejected", 1_000);
    setup
        .client()
        .dispute_claim(&id, &String::from_str(&setup.env, "rejected"), &setup.owner);
    setup.client().resolve_dispute(
        &id,
        &String::from_str(&setup.env, "rejected"),
        &false,
        &setup.arbitrator,
    );

    assert_eq!(setup.client().available(&id), 1_000);
    assert_eq!(setup.client().get_stream(&id).reserved, 0);
}

#[test]
fn client_cannot_close_a_running_stream() {
    let setup = setup();
    let id = create_stream(&setup);
    let result = setup.client().try_close(&id, &setup.owner);
    assert_eq!(result.unwrap_err().unwrap(), Error::StreamStillRunning);

    setup.env.ledger().set_sequence_number(500);
    assert_eq!(setup.client().close(&id, &setup.owner), 20_000);
}
