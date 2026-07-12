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
    StreamAttestation(u64),
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
    DuplicateStream = 10,
}

#[contractevent(topics = ["attestation_minted"])]
pub struct AttestationMinted {
    #[topic]
    pub attestation_id: u64,
    #[topic]
    pub stream_id: u64,
    #[topic]
    pub recipient: Address,
    pub total_paid: i128,
}

#[contract]
pub struct AttestationContract;

#[contractimpl]
impl AttestationContract {
    /// Atomic deployment-time setup. The stream contract is linked once after
    /// deployment with admin authorization, avoiding circular deploy addresses.
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::NextAttestationId, &1u64);
        env.storage()
            .instance()
            .extend_ttl(LEDGER_BUMP, LEDGER_BUMP);
    }

    pub fn set_stream_contract(
        env: Env,
        admin: Address,
        stream_contract: Address,
    ) -> Result<(), Error> {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        stored_admin.require_auth();
        if admin != stored_admin {
            return Err(Error::Unauthorized);
        }
        if env.storage().instance().has(&DataKey::StreamContract) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage()
            .instance()
            .set(&DataKey::StreamContract, &stream_contract);
        env.storage()
            .instance()
            .extend_ttl(LEDGER_BUMP, LEDGER_BUMP);
        Ok(())
    }

    /// Mints a permanent Work Attestation. `caller` MUST be the registered
    /// StreamContract address, AND that same address must satisfy
    /// `require_auth()`.
    #[allow(clippy::too_many_arguments)]
    pub fn mint_attestation(
        env: Env,
        caller: Address,
        stream_id: u64,
        sender: Address,
        recipient: Address,
        total_paid: i128,
        asset: Address,
        category: Category,
        title: String,
        start_ledger: u32,
        end_ledger: u32,
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
        if total_paid <= 0 {
            return Err(Error::InvalidPayment);
        }
        if start_ledger > end_ledger {
            return Err(Error::InvalidLedgerRange);
        }
        if title.len() > MAX_TITLE_LEN {
            return Err(Error::TitleTooLong);
        }
        if env
            .storage()
            .persistent()
            .has(&DataKey::StreamAttestation(stream_id))
        {
            return Err(Error::DuplicateStream);
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
            sender,
            recipient: recipient.clone(),
            total_paid,
            asset,
            category,
            title,
            start_ledger,
            end_ledger,
            minted_at_ledger: env.ledger().sequence(),
        };

        let key = DataKey::Attestation(id);
        env.storage().persistent().set(&key, &record);
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_BUMP, LEDGER_BUMP);

        let stream_key = DataKey::StreamAttestation(stream_id);
        env.storage().persistent().set(&stream_key, &id);
        env.storage()
            .persistent()
            .extend_ttl(&stream_key, LEDGER_BUMP, LEDGER_BUMP);

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
            recipient: record.recipient.clone(),
            total_paid,
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

    pub fn get_stream_attestation(env: Env, stream_id: u64) -> Result<u64, Error> {
        let key = DataKey::StreamAttestation(stream_id);
        let id: u64 = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::AttestationNotFound)?;
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_BUMP, LEDGER_BUMP);
        Ok(id)
    }

    /// Never panics on a missing id - returns false so verifier UIs can
    /// render a clean "not found" state instead of crashing.
    pub fn verify_attestation(env: Env, attestation_id: u64) -> bool {
        let key = DataKey::Attestation(attestation_id);
        match env
            .storage()
            .persistent()
            .get::<DataKey, AttestationRecord>(&key)
        {
            Some(record) => record.total_paid > 0,
            None => false,
        }
    }
}

mod test;
