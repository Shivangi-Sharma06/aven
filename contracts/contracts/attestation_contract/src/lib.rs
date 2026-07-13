#![no_std]

use shared::{AttestationRecord, Category, LEDGER_BUMP, MAX_HISTORY_LEN, MAX_TITLE_LEN};
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, vec, Address, Env, String,
    Vec,
};

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    StreamContract,
    NextAttestationId,
    Attestation(u64),
    RecipientAttestations(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    AttestationNotFound = 4,
    Overflow = 5,
    HistoryFull = 6,
    InvalidPayment = 7,
    InvalidLedgerRange = 8,
    TitleTooLong = 9,
}

#[contractevent(topics = ["attestation_minted"])]
pub struct AttestationMinted {
    #[topic]
    pub attestation_id: u64,
    #[topic]
    pub stream_id: u64,
    #[topic]
    pub checkpoint_index: u32,
    pub recipient: Address,
    pub amount_paid: i128,
    pub client_confirmed: bool,
}

#[contract]
pub struct AttestationContract;

#[contractimpl]
impl AttestationContract {
    pub fn init(env: Env, admin: Address, stream_contract: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::StreamContract, &stream_contract);
        env.storage()
            .instance()
            .set(&DataKey::NextAttestationId, &1u64);
        env.storage()
            .instance()
            .extend_ttl(LEDGER_BUMP, LEDGER_BUMP);
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn mint_attestation(
        env: Env,
        caller: Address,
        stream_id: u64,
        checkpoint_index: u32,
        sender: Address,
        recipient: Address,
        amount_paid: i128,
        asset: Address,
        category: Category,
        title: String,
        period_start_ledger: u32,
        period_end_ledger: u32,
        client_confirmed: bool,
    ) -> Result<u64, Error> {
        caller.require_auth();

        let registered_stream_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::StreamContract)
            .ok_or(Error::NotInitialized)?;
        if caller != registered_stream_contract {
            return Err(Error::Unauthorized);
        }
        if amount_paid <= 0 {
            return Err(Error::InvalidPayment);
        }
        if period_start_ledger > period_end_ledger {
            return Err(Error::InvalidLedgerRange);
        }
        if title.len() > MAX_TITLE_LEN {
            return Err(Error::TitleTooLong);
        }

        env.storage()
            .instance()
            .extend_ttl(LEDGER_BUMP, LEDGER_BUMP);

        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextAttestationId)
            .unwrap_or(1u64);
        let next_id = id.checked_add(1).ok_or(Error::Overflow)?;
        env.storage()
            .instance()
            .set(&DataKey::NextAttestationId, &next_id);

        let record = AttestationRecord {
            id,
            stream_id,
            checkpoint_index,
            sender,
            recipient: recipient.clone(),
            amount_paid,
            asset,
            category,
            title,
            period_start_ledger,
            period_end_ledger,
            minted_at_ledger: env.ledger().sequence(),
            client_confirmed,
        };

        let key = DataKey::Attestation(id);
        env.storage().persistent().set(&key, &record);
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_BUMP, LEDGER_BUMP);

        let list_key = DataKey::RecipientAttestations(recipient);
        let mut list: Vec<u64> = env
            .storage()
            .persistent()
            .get(&list_key)
            .unwrap_or(vec![&env]);
        if list.len() >= MAX_HISTORY_LEN {
            return Err(Error::HistoryFull);
        }
        list.push_back(id);
        env.storage().persistent().set(&list_key, &list);
        env.storage()
            .persistent()
            .extend_ttl(&list_key, LEDGER_BUMP, LEDGER_BUMP);

        AttestationMinted {
            attestation_id: id,
            stream_id,
            checkpoint_index,
            recipient: record.recipient.clone(),
            amount_paid,
            client_confirmed,
        }
        .publish(&env);

        Ok(id)
    }

    pub fn get_attestation(env: Env, attestation_id: u64) -> Result<AttestationRecord, Error> {
        let key = DataKey::Attestation(attestation_id);
        let record: AttestationRecord = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::AttestationNotFound)?;
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_BUMP, LEDGER_BUMP);
        Ok(record)
    }

    pub fn get_recipient_attestations(env: Env, recipient: Address) -> Vec<u64> {
        let key = DataKey::RecipientAttestations(recipient);
        let ids = env.storage().persistent().get(&key).unwrap_or(vec![&env]);
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_BUMP, LEDGER_BUMP);
        ids
    }

    pub fn verify_attestation(env: Env, attestation_id: u64) -> bool {
        let key = DataKey::Attestation(attestation_id);
        match env
            .storage()
            .persistent()
            .get::<DataKey, AttestationRecord>(&key)
        {
            Some(record) => record.amount_paid > 0,
            None => false,
        }
    }
}

mod test;
