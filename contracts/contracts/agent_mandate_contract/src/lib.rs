#![no_std]

use shared::{Category, MAX_CHECKPOINTS, MAX_TITLE_LEN};
use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype, token, vec,
    Address, BytesN, Env, IntoVal, String, Symbol, Vec,
};

#[contractclient(name = "StreamContractClient")]
pub trait StreamContractInterface {
    #[allow(clippy::too_many_arguments)]
    fn create_stream(
        env: Env,
        sender: Address,
        recipient: Address,
        rate_per_second: i128,
        asset: Address,
        total_deposited: i128,
        duration_ledgers: u32,
        checkpoint_count: u32,
        withdrawable_cap_percent: u32,
        approval_timeout_ledgers: u32,
        category: Category,
        title: String,
    ) -> u64;

    fn approve_checkpoint(env: Env, stream_id: u64, sender: Address, index: u32) -> u64;
}

const LEDGER_BUMP: u32 = 535_680;
const MAX_ALLOWED_ASSETS: u32 = 8;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MandatePolicy {
    pub per_stream_limit: i128,
    pub window_limit: i128,
    pub window_ledgers: u32,
    pub max_duration_ledgers: u32,
    pub max_checkpoint_count: u32,
    pub human_approval_threshold: i128,
    pub expires_at_ledger: u32,
    pub enforce_recipient_allowlist: bool,
    pub agent_can_approve_checkpoints: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MandateConfig {
    pub owner: Address,
    pub agent: Address,
    pub stream_contract: Address,
    pub policy: MandatePolicy,
    pub paused: bool,
    pub revoked: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpendWindow {
    pub window_start: u32,
    pub spent: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StreamParams {
    pub recipient: Address,
    pub asset: Address,
    pub total_deposited: i128,
    pub rate_per_second: i128,
    pub duration_ledgers: u32,
    pub checkpoint_count: u32,
    pub withdrawable_cap_percent: u32,
    pub approval_timeout_ledgers: u32,
    pub category: Category,
    pub title: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProposalStatus {
    Pending,
    Executed,
    Rejected,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StreamProposal {
    pub id: u64,
    pub request_id: BytesN<32>,
    pub params: StreamParams,
    pub status: ProposalStatus,
    pub stream_id: u64,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Config,
    NextProposalId,
    SpendWindow,
    AllowedAsset(Address),
    AllowedRecipient(Address),
    RequestUsed(BytesN<32>),
    Proposal(u64),
    ManagedStream(u64),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidPolicy = 1,
    InvalidAmount = 2,
    InvalidStream = 3,
    MandatePaused = 4,
    MandateRevoked = 5,
    MandateExpired = 6,
    AssetNotAllowed = 7,
    RecipientNotAllowed = 8,
    PerStreamLimitExceeded = 9,
    WindowLimitExceeded = 10,
    OwnerApprovalRequired = 11,
    DuplicateRequest = 12,
    ProposalNotFound = 13,
    ProposalNotPending = 14,
    InsufficientMandateBalance = 15,
    NotAuthorized = 16,
    StreamNotManaged = 17,
    Overflow = 18,
    TooManyAssets = 19,
}

#[contractevent(topics = ["mandate", "funded"])]
pub struct MandateFunded {
    #[topic]
    pub owner: Address,
    #[topic]
    pub asset: Address,
    pub amount: i128,
}

#[contractevent(topics = ["mandate", "policy_updated"])]
pub struct PolicyUpdated {
    #[topic]
    pub owner: Address,
}

#[contractevent(topics = ["mandate", "recipient_set"])]
pub struct RecipientSet {
    #[topic]
    pub recipient: Address,
    pub allowed: bool,
}

#[contractevent(topics = ["mandate", "asset_set"])]
pub struct AssetSet {
    #[topic]
    pub asset: Address,
    pub allowed: bool,
}

#[contractevent(topics = ["mandate", "stream_proposed"])]
pub struct StreamProposed {
    #[topic]
    pub proposal_id: u64,
    #[topic]
    pub agent: Address,
    pub request_id: BytesN<32>,
    pub amount: i128,
}

#[contractevent(topics = ["mandate", "proposal_resolved"])]
pub struct ProposalResolved {
    #[topic]
    pub proposal_id: u64,
    pub approved: bool,
    pub stream_id: u64,
}

#[contractevent(topics = ["mandate", "stream_executed"])]
pub struct StreamExecuted {
    #[topic]
    pub stream_id: u64,
    #[topic]
    pub agent: Address,
    pub request_id: BytesN<32>,
    pub amount: i128,
}

#[contractevent(topics = ["mandate", "checkpoint_approved"])]
pub struct CheckpointApproved {
    #[topic]
    pub stream_id: u64,
    #[topic]
    pub index: u32,
    pub attestation_id: u64,
}

#[contractevent(topics = ["mandate", "status_changed"])]
pub struct StatusChanged {
    #[topic]
    pub owner: Address,
    pub paused: bool,
    pub revoked: bool,
}

#[contractevent(topics = ["mandate", "funds_withdrawn"])]
pub struct FundsWithdrawn {
    #[topic]
    pub owner: Address,
    #[topic]
    pub asset: Address,
    pub destination: Address,
    pub amount: i128,
}

#[contract]
pub struct AgentMandateContract;

#[contractimpl]
impl AgentMandateContract {
    pub fn __constructor(
        env: Env,
        owner: Address,
        agent: Address,
        stream_contract: Address,
        allowed_assets: Vec<Address>,
        policy: MandatePolicy,
    ) {
        if allowed_assets.is_empty() || allowed_assets.len() > MAX_ALLOWED_ASSETS {
            soroban_sdk::panic_with_error!(&env, Error::TooManyAssets);
        }
        if validate_policy(&env, &policy).is_err() {
            soroban_sdk::panic_with_error!(&env, Error::InvalidPolicy);
        }

        let config = MandateConfig {
            owner,
            agent,
            stream_contract,
            policy,
            paused: false,
            revoked: false,
        };
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage()
            .instance()
            .set(&DataKey::NextProposalId, &1u64);
        env.storage().persistent().set(
            &DataKey::SpendWindow,
            &SpendWindow {
                window_start: env.ledger().sequence(),
                spent: 0,
            },
        );

        for asset in allowed_assets.iter() {
            let key = DataKey::AllowedAsset(asset);
            env.storage().persistent().set(&key, &true);
            bump_persistent(&env, &key);
        }
        bump_instance(&env);
        bump_persistent(&env, &DataKey::SpendWindow);
    }

    pub fn get_config(env: Env) -> MandateConfig {
        load_config(&env)
    }

    pub fn get_spend_window(env: Env) -> SpendWindow {
        current_window(&env, &load_config(&env).policy)
    }

    pub fn is_asset_allowed(env: Env, asset: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::AllowedAsset(asset))
            .unwrap_or(false)
    }

    pub fn is_recipient_allowed(env: Env, recipient: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::AllowedRecipient(recipient))
            .unwrap_or(false)
    }

    pub fn is_request_used(env: Env, request_id: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::RequestUsed(request_id))
            .unwrap_or(false)
    }

    pub fn get_proposal(env: Env, proposal_id: u64) -> Result<StreamProposal, Error> {
        let key = DataKey::Proposal(proposal_id);
        let proposal = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::ProposalNotFound)?;
        bump_persistent(&env, &key);
        Ok(proposal)
    }

    pub fn get_balance(env: Env, asset: Address) -> i128 {
        token::Client::new(&env, &asset).balance(&env.current_contract_address())
    }

    pub fn deposit(env: Env, owner: Address, asset: Address, amount: i128) -> Result<(), Error> {
        owner.require_auth();
        let config = load_config(&env);
        require_owner(&config, &owner)?;
        if config.revoked {
            return Err(Error::MandateRevoked);
        }
        require_asset(&env, &asset)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        token::Client::new(&env, &asset).transfer(&owner, &env.current_contract_address(), &amount);
        bump_instance(&env);
        MandateFunded {
            owner,
            asset,
            amount,
        }
        .publish(&env);
        Ok(())
    }

    pub fn withdraw_unused(
        env: Env,
        owner: Address,
        asset: Address,
        amount: i128,
        destination: Address,
    ) -> Result<(), Error> {
        owner.require_auth();
        let config = load_config(&env);
        require_owner(&config, &owner)?;
        require_asset(&env, &asset)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let mandate = env.current_contract_address();
        let token_client = token::Client::new(&env, &asset);
        if token_client.balance(&mandate) < amount {
            return Err(Error::InsufficientMandateBalance);
        }
        token_client.transfer(&mandate, &destination, &amount);
        FundsWithdrawn {
            owner,
            asset,
            destination,
            amount,
        }
        .publish(&env);
        Ok(())
    }

    pub fn update_policy(env: Env, owner: Address, policy: MandatePolicy) -> Result<(), Error> {
        owner.require_auth();
        let mut config = load_config(&env);
        require_owner(&config, &owner)?;
        if config.revoked {
            return Err(Error::MandateRevoked);
        }
        validate_policy(&env, &policy)?;
        let window_changed = config.policy.window_ledgers != policy.window_ledgers;
        config.policy = policy;
        save_config(&env, &config);
        if window_changed {
            save_window(
                &env,
                &SpendWindow {
                    window_start: env.ledger().sequence(),
                    spent: 0,
                },
            );
        }
        PolicyUpdated { owner }.publish(&env);
        Ok(())
    }

    pub fn set_agent(env: Env, owner: Address, agent: Address) -> Result<(), Error> {
        owner.require_auth();
        let mut config = load_config(&env);
        require_owner(&config, &owner)?;
        if config.revoked {
            return Err(Error::MandateRevoked);
        }
        config.agent = agent;
        save_config(&env, &config);
        PolicyUpdated { owner }.publish(&env);
        Ok(())
    }

    pub fn set_asset(env: Env, owner: Address, asset: Address, allowed: bool) -> Result<(), Error> {
        owner.require_auth();
        let config = load_config(&env);
        require_owner(&config, &owner)?;
        if config.revoked {
            return Err(Error::MandateRevoked);
        }
        let key = DataKey::AllowedAsset(asset.clone());
        env.storage().persistent().set(&key, &allowed);
        bump_persistent(&env, &key);
        AssetSet { asset, allowed }.publish(&env);
        Ok(())
    }

    pub fn set_recipient(
        env: Env,
        owner: Address,
        recipient: Address,
        allowed: bool,
    ) -> Result<(), Error> {
        owner.require_auth();
        let config = load_config(&env);
        require_owner(&config, &owner)?;
        if config.revoked {
            return Err(Error::MandateRevoked);
        }
        let key = DataKey::AllowedRecipient(recipient.clone());
        env.storage().persistent().set(&key, &allowed);
        bump_persistent(&env, &key);
        RecipientSet { recipient, allowed }.publish(&env);
        Ok(())
    }

    pub fn pause(env: Env, owner: Address) -> Result<(), Error> {
        owner.require_auth();
        let mut config = load_config(&env);
        require_owner(&config, &owner)?;
        if config.revoked {
            return Err(Error::MandateRevoked);
        }
        config.paused = true;
        save_config(&env, &config);
        StatusChanged {
            owner,
            paused: true,
            revoked: false,
        }
        .publish(&env);
        Ok(())
    }

    pub fn resume(env: Env, owner: Address) -> Result<(), Error> {
        owner.require_auth();
        let mut config = load_config(&env);
        require_owner(&config, &owner)?;
        if config.revoked {
            return Err(Error::MandateRevoked);
        }
        config.paused = false;
        save_config(&env, &config);
        StatusChanged {
            owner,
            paused: false,
            revoked: false,
        }
        .publish(&env);
        Ok(())
    }

    pub fn revoke(env: Env, owner: Address) -> Result<(), Error> {
        owner.require_auth();
        let mut config = load_config(&env);
        require_owner(&config, &owner)?;
        config.revoked = true;
        config.paused = true;
        save_config(&env, &config);
        StatusChanged {
            owner,
            paused: true,
            revoked: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn execute_stream(
        env: Env,
        agent: Address,
        request_id: BytesN<32>,
        params: StreamParams,
    ) -> Result<u64, Error> {
        agent.require_auth();
        let config = load_config(&env);
        require_agent(&config, &agent)?;
        validate_stream(&env, &config, &params)?;
        if params.total_deposited >= config.policy.human_approval_threshold {
            return Err(Error::OwnerApprovalRequired);
        }
        consume_request(&env, &request_id)?;
        execute_validated_stream(&env, &config, &agent, &request_id, &params)
    }

    pub fn propose_stream(
        env: Env,
        agent: Address,
        request_id: BytesN<32>,
        params: StreamParams,
    ) -> Result<u64, Error> {
        agent.require_auth();
        let config = load_config(&env);
        require_agent(&config, &agent)?;
        validate_stream(&env, &config, &params)?;
        consume_request(&env, &request_id)?;

        let proposal_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextProposalId)
            .unwrap_or(1);
        let next_id = proposal_id.checked_add(1).ok_or(Error::Overflow)?;
        env.storage()
            .instance()
            .set(&DataKey::NextProposalId, &next_id);
        let proposal = StreamProposal {
            id: proposal_id,
            request_id: request_id.clone(),
            params: params.clone(),
            status: ProposalStatus::Pending,
            stream_id: 0,
        };
        save_proposal(&env, &proposal);
        StreamProposed {
            proposal_id,
            agent,
            request_id,
            amount: params.total_deposited,
        }
        .publish(&env);
        Ok(proposal_id)
    }

    pub fn approve_and_execute(env: Env, owner: Address, proposal_id: u64) -> Result<u64, Error> {
        owner.require_auth();
        let config = load_config(&env);
        require_owner(&config, &owner)?;
        let mut proposal = load_proposal(&env, proposal_id)?;
        if proposal.status != ProposalStatus::Pending {
            return Err(Error::ProposalNotPending);
        }
        validate_stream(&env, &config, &proposal.params)?;
        let stream_id = execute_validated_stream(
            &env,
            &config,
            &config.agent,
            &proposal.request_id,
            &proposal.params,
        )?;
        proposal.status = ProposalStatus::Executed;
        proposal.stream_id = stream_id;
        save_proposal(&env, &proposal);
        ProposalResolved {
            proposal_id,
            approved: true,
            stream_id,
        }
        .publish(&env);
        Ok(stream_id)
    }

    pub fn reject_proposal(env: Env, owner: Address, proposal_id: u64) -> Result<(), Error> {
        owner.require_auth();
        let config = load_config(&env);
        require_owner(&config, &owner)?;
        let mut proposal = load_proposal(&env, proposal_id)?;
        if proposal.status != ProposalStatus::Pending {
            return Err(Error::ProposalNotPending);
        }
        proposal.status = ProposalStatus::Rejected;
        save_proposal(&env, &proposal);
        ProposalResolved {
            proposal_id,
            approved: false,
            stream_id: 0,
        }
        .publish(&env);
        Ok(())
    }

    pub fn approve_checkpoint(
        env: Env,
        caller: Address,
        stream_id: u64,
        index: u32,
    ) -> Result<u64, Error> {
        caller.require_auth();
        let config = load_config(&env);
        let is_owner = caller == config.owner;
        let is_agent = caller == config.agent && config.policy.agent_can_approve_checkpoints;
        if !is_owner && !is_agent {
            return Err(Error::NotAuthorized);
        }
        if is_agent {
            require_active(&env, &config)?;
        }
        if !env
            .storage()
            .persistent()
            .get(&DataKey::ManagedStream(stream_id))
            .unwrap_or(false)
        {
            return Err(Error::StreamNotManaged);
        }

        let attestation_id = StreamContractClient::new(&env, &config.stream_contract)
            .approve_checkpoint(&stream_id, &env.current_contract_address(), &index);
        CheckpointApproved {
            stream_id,
            index,
            attestation_id,
        }
        .publish(&env);
        Ok(attestation_id)
    }
}

fn validate_policy(env: &Env, policy: &MandatePolicy) -> Result<(), Error> {
    if policy.per_stream_limit <= 0
        || policy.window_limit <= 0
        || policy.window_ledgers == 0
        || policy.max_duration_ledgers == 0
        || policy.max_checkpoint_count == 0
        || policy.max_checkpoint_count > MAX_CHECKPOINTS
        || policy.human_approval_threshold < 0
        || policy.expires_at_ledger <= env.ledger().sequence()
    {
        return Err(Error::InvalidPolicy);
    }
    Ok(())
}

fn validate_stream(env: &Env, config: &MandateConfig, params: &StreamParams) -> Result<(), Error> {
    require_active(env, config)?;
    if params.total_deposited <= 0 || params.rate_per_second <= 0 {
        return Err(Error::InvalidAmount);
    }
    require_asset(env, &params.asset)?;
    if config.policy.enforce_recipient_allowlist
        && !env
            .storage()
            .persistent()
            .get(&DataKey::AllowedRecipient(params.recipient.clone()))
            .unwrap_or(false)
    {
        return Err(Error::RecipientNotAllowed);
    }
    if params.total_deposited > config.policy.per_stream_limit {
        return Err(Error::PerStreamLimitExceeded);
    }
    if params.duration_ledgers == 0
        || params.duration_ledgers > config.policy.max_duration_ledgers
        || params.checkpoint_count == 0
        || params.checkpoint_count > config.policy.max_checkpoint_count
        || params.duration_ledgers % params.checkpoint_count != 0
        || params.withdrawable_cap_percent > 100
        || params.approval_timeout_ledgers == 0
        || params.title.len() > MAX_TITLE_LEN
    {
        return Err(Error::InvalidStream);
    }
    let required = params
        .rate_per_second
        .checked_mul(5)
        .and_then(|rate| rate.checked_mul(params.duration_ledgers as i128))
        .ok_or(Error::Overflow)?;
    if params.total_deposited < required {
        return Err(Error::InvalidStream);
    }
    Ok(())
}

fn execute_validated_stream(
    env: &Env,
    config: &MandateConfig,
    agent: &Address,
    request_id: &BytesN<32>,
    params: &StreamParams,
) -> Result<u64, Error> {
    charge_window(env, &config.policy, params.total_deposited)?;
    let mandate = env.current_contract_address();
    let token_client = token::Client::new(env, &params.asset);
    if token_client.balance(&mandate) < params.total_deposited {
        return Err(Error::InsufficientMandateBalance);
    }

    authorize_stream_transfer(env, config, params, &mandate);
    let stream_id = StreamContractClient::new(env, &config.stream_contract).create_stream(
        &mandate,
        &params.recipient,
        &params.rate_per_second,
        &params.asset,
        &params.total_deposited,
        &params.duration_ledgers,
        &params.checkpoint_count,
        &params.withdrawable_cap_percent,
        &params.approval_timeout_ledgers,
        &params.category,
        &params.title,
    );
    let key = DataKey::ManagedStream(stream_id);
    env.storage().persistent().set(&key, &true);
    bump_persistent(env, &key);
    StreamExecuted {
        stream_id,
        agent: agent.clone(),
        request_id: request_id.clone(),
        amount: params.total_deposited,
    }
    .publish(env);
    Ok(stream_id)
}

fn authorize_stream_transfer(
    env: &Env,
    config: &MandateConfig,
    params: &StreamParams,
    mandate: &Address,
) {
    let token_invocation = SubContractInvocation {
        context: ContractContext {
            contract: params.asset.clone(),
            fn_name: Symbol::new(env, "transfer"),
            args: (
                mandate.clone(),
                config.stream_contract.clone(),
                params.total_deposited,
            )
                .into_val(env),
        },
        sub_invocations: vec![env],
    };
    env.authorize_as_current_contract(vec![
        env,
        InvokerContractAuthEntry::Contract(token_invocation),
    ]);
}

fn charge_window(env: &Env, policy: &MandatePolicy, amount: i128) -> Result<(), Error> {
    let mut window = current_window(env, policy);
    let new_spent = window.spent.checked_add(amount).ok_or(Error::Overflow)?;
    if new_spent > policy.window_limit {
        return Err(Error::WindowLimitExceeded);
    }
    window.spent = new_spent;
    save_window(env, &window);
    Ok(())
}

fn current_window(env: &Env, policy: &MandatePolicy) -> SpendWindow {
    let mut window: SpendWindow = env
        .storage()
        .persistent()
        .get(&DataKey::SpendWindow)
        .unwrap_or(SpendWindow {
            window_start: env.ledger().sequence(),
            spent: 0,
        });
    let window_end = window
        .window_start
        .checked_add(policy.window_ledgers)
        .unwrap_or(u32::MAX);
    if env.ledger().sequence() >= window_end {
        window = SpendWindow {
            window_start: env.ledger().sequence(),
            spent: 0,
        };
    }
    window
}

fn save_window(env: &Env, window: &SpendWindow) {
    env.storage()
        .persistent()
        .set(&DataKey::SpendWindow, window);
    bump_persistent(env, &DataKey::SpendWindow);
}

fn consume_request(env: &Env, request_id: &BytesN<32>) -> Result<(), Error> {
    let key = DataKey::RequestUsed(request_id.clone());
    if env.storage().persistent().get(&key).unwrap_or(false) {
        return Err(Error::DuplicateRequest);
    }
    env.storage().persistent().set(&key, &true);
    bump_persistent(env, &key);
    Ok(())
}

fn load_config(env: &Env) -> MandateConfig {
    bump_instance(env);
    env.storage().instance().get(&DataKey::Config).unwrap()
}

fn save_config(env: &Env, config: &MandateConfig) {
    env.storage().instance().set(&DataKey::Config, config);
    bump_instance(env);
}

fn load_proposal(env: &Env, proposal_id: u64) -> Result<StreamProposal, Error> {
    let key = DataKey::Proposal(proposal_id);
    let proposal = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::ProposalNotFound)?;
    bump_persistent(env, &key);
    Ok(proposal)
}

fn save_proposal(env: &Env, proposal: &StreamProposal) {
    let key = DataKey::Proposal(proposal.id);
    env.storage().persistent().set(&key, proposal);
    bump_persistent(env, &key);
}

fn require_owner(config: &MandateConfig, caller: &Address) -> Result<(), Error> {
    if caller != &config.owner {
        return Err(Error::NotAuthorized);
    }
    Ok(())
}

fn require_agent(config: &MandateConfig, caller: &Address) -> Result<(), Error> {
    if caller != &config.agent {
        return Err(Error::NotAuthorized);
    }
    Ok(())
}

fn require_active(env: &Env, config: &MandateConfig) -> Result<(), Error> {
    if config.revoked {
        return Err(Error::MandateRevoked);
    }
    if config.paused {
        return Err(Error::MandatePaused);
    }
    if env.ledger().sequence() >= config.policy.expires_at_ledger {
        return Err(Error::MandateExpired);
    }
    Ok(())
}

fn require_asset(env: &Env, asset: &Address) -> Result<(), Error> {
    if !env
        .storage()
        .persistent()
        .get(&DataKey::AllowedAsset(asset.clone()))
        .unwrap_or(false)
    {
        return Err(Error::AssetNotAllowed);
    }
    Ok(())
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(LEDGER_BUMP / 2, LEDGER_BUMP);
}

fn bump_persistent(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, LEDGER_BUMP / 2, LEDGER_BUMP);
}

#[cfg(test)]
mod test;
