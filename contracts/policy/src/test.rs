#![cfg(test)]
use crate::{EunomiaPolicy, EunomiaPolicyClient};
use soroban_sdk::{contract, contractimpl, testutils::Address as _, Address, Env};

fn setup() -> (Env, EunomiaPolicyClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let id = env.register(EunomiaPolicy, (admin,));
    (env.clone(), EunomiaPolicyClient::new(&env, &id))
}

#[test]
fn whitelisted_payee_is_authorized() {
    let (env, policy) = setup();
    let token = Address::generate(&env); // a confidential token would pass its own address
    let payee = Address::generate(&env);

    // Unknown payee is rejected — the default is a closed allowlist.
    assert!(!policy.is_authorized(&payee, &token));

    policy.add_payee(&payee);
    assert!(policy.is_authorized(&payee, &token));

    policy.remove_payee(&payee);
    assert!(!policy.is_authorized(&payee, &token));
}

// A stand-in ERC-8004 reputation registry: every account scores 80.
#[contract]
pub struct MockReputation;

#[contractimpl]
impl MockReputation {
    pub fn reputation_of(_env: Env, _agent: Address) -> i128 {
        80
    }
}

#[test]
fn reputation_gated_payee_is_authorized() {
    let (env, policy) = setup();
    let token = Address::generate(&env);
    let payee = Address::generate(&env); // NOT whitelisted
    let rep = env.register(MockReputation, ());

    // No reputation policy yet → a non-whitelisted payee is rejected.
    assert!(!policy.is_authorized(&payee, &token));

    // Gate at min 50; the payee scores 80 → authorized by earned trust.
    policy.set_reputation_policy(&rep, &50);
    assert!(policy.is_authorized(&payee, &token));

    // Raise the bar above the score → rejected again.
    policy.set_reputation_policy(&rep, &100);
    assert!(!policy.is_authorized(&payee, &token));

    // min_reputation = 0 disables the gate (whitelist-only) → rejected.
    policy.set_reputation_policy(&rep, &0);
    assert!(!policy.is_authorized(&payee, &token));
}
