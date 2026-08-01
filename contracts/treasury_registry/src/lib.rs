#![no_std]
//! Eunomia Treasury Registry — a permissionless on-chain index of "which treasuries
//! does this wallet own?", so a user can recover their treasury from any device
//! instead of relying on one browser's localStorage.
//!
//! Deliberately minimal: no admin, no constructor, no unregister. Only the owner
//! can append to their own list (`owner.require_auth`) and pays their own storage
//! rent, so no cap is needed; the data is pure discovery (not funds), so stale
//! entries are simply filtered client-side when the treasury no longer loads.
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Vec};

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Owned(Address),
}

#[contract]
pub struct TreasuryRegistry;

#[contractimpl]
impl TreasuryRegistry {
    /// Record that `owner` operates `treasury`. Owner-signed; duplicates are a no-op.
    pub fn register(env: Env, owner: Address, treasury: Address) {
        owner.require_auth();
        let key = DataKey::Owned(owner.clone());
        let mut owned: Vec<Address> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env));
        if !owned.contains(&treasury) {
            owned.push_back(treasury.clone());
            env.storage().persistent().set(&key, &owned);
            env.events()
                .publish((symbol_short!("regd"), owner), treasury);
        }
    }

    /// Every treasury registered by `owner`, oldest → newest (empty when none).
    pub fn treasuries_of(env: Env, owner: Address) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Owned(owner))
            .unwrap_or(Vec::new(&env))
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn register_lists_and_dedupes() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(TreasuryRegistry, ());
        let client = TreasuryRegistryClient::new(&env, &id);

        let owner = Address::generate(&env);
        let t1 = Address::generate(&env);
        let t2 = Address::generate(&env);

        client.register(&owner, &t1);
        client.register(&owner, &t2);
        client.register(&owner, &t1); // duplicate — no-op

        let owned = client.treasuries_of(&owner);
        assert_eq!(owned.len(), 2);
        assert_eq!(owned.get(0).unwrap(), t1); // insertion order preserved
        assert_eq!(owned.get(1).unwrap(), t2);
    }

    #[test]
    fn register_requires_owner_auth() {
        let env = Env::default();
        let id = env.register(TreasuryRegistry, ());
        let client = TreasuryRegistryClient::new(&env, &id);

        let owner = Address::generate(&env);
        let t1 = Address::generate(&env);

        env.set_auths(&[]);
        assert!(client.try_register(&owner, &t1).is_err());
        assert_eq!(client.treasuries_of(&owner).len(), 0);
    }

    #[test]
    fn unknown_owner_returns_empty() {
        let env = Env::default();
        let id = env.register(TreasuryRegistry, ());
        let client = TreasuryRegistryClient::new(&env, &id);
        assert_eq!(client.treasuries_of(&Address::generate(&env)).len(), 0);
    }
}
