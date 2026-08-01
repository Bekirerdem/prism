#![no_std]
//! Eunomia Compliance Policy
//!
//! A `Policy` for OpenZeppelin's Confidential Token `ComplianceHooks` (external
//! authorization). Wired as the confidential token's `compliance.policy`, it gates
//! every confidential transfer behind Eunomia's payee rule — **whitelist OR earned
//! reputation** — the exact gate the Eunomia treasury enforces, now applied where the
//! *amount is hidden*. The Confidential Token hides the amount; Eunomia bounds the payee.
//!
//! See OpenZeppelin Confidential Token `compliance::Policy`:
//!   `fn is_authorized(e, account, token) -> bool`

use soroban_sdk::{contract, contractclient, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Payee(Address),
    RepRegistry,
    MinReputation,
}

/// ERC-8004-style reputation registry Eunomia reads to authorize a *non-whitelisted*
/// payee by earned trust (the same interface the treasury uses).
#[contractclient(name = "ReputationClient")]
pub trait ReputationOracle {
    fn reputation_of(env: Env, agent: Address) -> i128;
}

#[contract]
pub struct EunomiaPolicy;

#[contractimpl]
impl EunomiaPolicy {
    /// Atomic init at deploy (no front-runnable `initialize`).
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Whitelist a payee. Admin-only.
    pub fn add_payee(env: Env, payee: Address) {
        Self::admin(&env).require_auth();
        env.storage().persistent().set(&DataKey::Payee(payee), &true);
    }

    /// Remove a payee from the whitelist. Admin-only.
    pub fn remove_payee(env: Env, payee: Address) {
        Self::admin(&env).require_auth();
        env.storage().persistent().remove(&DataKey::Payee(payee));
    }

    /// Configure the reputation gate. With `min_reputation > 0`, a non-whitelisted
    /// payee scoring `>= min_reputation` from `registry` is authorized. Set
    /// `min_reputation = 0` to disable it (whitelist-only). Admin-only.
    pub fn set_reputation_policy(env: Env, registry: Address, min_reputation: i128) {
        Self::admin(&env).require_auth();
        env.storage().instance().set(&DataKey::RepRegistry, &registry);
        env.storage().instance().set(&DataKey::MinReputation, &min_reputation);
    }

    /// Whitelist membership (a view; the full gate is `is_authorized`).
    pub fn is_payee(env: Env, payee: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Payee(payee))
            .unwrap_or(false)
    }

    /// OpenZeppelin Confidential Token `Policy` entry point. Returns `true` iff
    /// `account` may transact in `token` — **whitelisted OR earned reputation >= min**.
    /// The confidential token passes its own address as `token`, so one policy can
    /// serve many tokens (per-token rules could branch on it; a single rule here).
    pub fn is_authorized(env: Env, account: Address, _token: Address) -> bool {
        if Self::is_payee(env.clone(), account.clone()) {
            return true;
        }
        let registry: Option<Address> = env.storage().instance().get(&DataKey::RepRegistry);
        let min: i128 = env
            .storage()
            .instance()
            .get(&DataKey::MinReputation)
            .unwrap_or(0);
        match registry {
            Some(reg) if min > 0 => {
                ReputationClient::new(&env, &reg).reputation_of(&account) >= min
            }
            _ => false,
        }
    }
}

// Non-exported helper (separate impl block — not part of the ABI).
impl EunomiaPolicy {
    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}

mod test;
