#![no_std]

use shared::{AttestationRecord, Category, LEDGER_BUMP, MAX_HISTORY_LEN};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, vec, Address, Env, String,
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
}

#[contract]
pub struct AttestationContract;

#[contractimpl]
impl AttestationContract {
    /// One-time setup. Stores the single address allowed to mint
    /// attestations. This is the entire trust boundary of the protocol -
    /// nothing else in this contract needs to be locked down as tightly.
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

        env.storage()
            .instance()
            .extend_ttl(LEDGER_BUMP, LEDGER_BUMP);

        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextAttestationId)
            .unwrap_or(1u64);
        let next_id = id.checked_add(1).ok_or(Error::Overflow)?;
        env.storage().instance().set(&DataKey::NextAttestationId, &next_id);

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

        env.events().publish((symbol_short!("minted"), id), stream_id);

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
        env.storage()
            .persistent()
            .get(&DataKey::RecipientAttestations(recipient))
            .unwrap_or(vec![&env])
    }

    /// Never panics on a missing id - returns false so verifier UIs can
    /// render a clean "not found" state instead of crashing.
    pub fn verify_attestation(env: Env, attestation_id: u64) -> bool {
        let key = DataKey::Attestation(attestation_id);
        match env.storage().persistent().get::<DataKey, AttestationRecord>(&key) {
            Some(record) => record.total_paid > 0,
            None => false,
        }
    }
}

mod test;