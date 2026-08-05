#![cfg(test)]

use super::*;
use soroban_sdk::{
    contract, contractimpl,
    testutils::{storage::Instance as _, Address as _, Ledger, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    Address, Env, IntoVal,
};

/// Deploy a fresh treasury + test token (funded with 500 units) and return the
/// handles the tests need. `daily_limit` / `per_task_limit` go to the constructor.
fn setup<'a>(
    env: &'a Env,
    daily_limit: i128,
    per_task_limit: i128,
) -> (Address, TreasuryClient<'a>, TokenClient<'a>) {
    let admin = Address::generate(env);
    let agent = Address::generate(env);
    let payee = Address::generate(env);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = sac.address();
    let token_admin = StellarAssetClient::new(env, &token_addr);
    let token = TokenClient::new(env, &token_addr);

    let id = env.register(
        Treasury,
        (admin, agent, token_addr, daily_limit, per_task_limit),
    );
    let client = TreasuryClient::new(env, &id);
    token_admin.mint(&id, &500_i128);

    (payee, client, token)
}

#[test]
fn pay_accounting_and_rejections() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let agent = Address::generate(&env);
    let payee = Address::generate(&env);
    let attacker = Address::generate(&env);

    // Deploy a test token (Stellar Asset Contract) with `admin` as issuer.
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = sac.address();
    let token_admin = StellarAssetClient::new(&env, &token_addr);
    let token = TokenClient::new(&env, &token_addr);

    // Deploy the treasury: daily_limit = 1000, per_task_limit = 100.
    let id = env.register(
        Treasury,
        (
            admin.clone(),
            agent.clone(),
            token_addr.clone(),
            1000_i128,
            100_i128,
        ),
    );
    let client = TreasuryClient::new(&env, &id);

    // Fund the treasury with 500 units.
    token_admin.mint(&id, &500_i128);
    assert_eq!(client.balance(), 500);

    // Whitelist the payee.
    client.add_payee(&payee);
    assert!(client.is_payee(&payee));

    // Legit payment within limits.
    client.pay(&1_u64, &payee, &50_i128);
    assert_eq!(token.balance(&payee), 50);
    assert_eq!(client.task_spent(&1), 50);
    assert_eq!(client.day_spent(), 50);

    // Reject: recipient not whitelisted (the "rogue / prompt-injected" case).
    assert_eq!(
        client.try_pay(&2_u64, &attacker, &10_i128),
        Err(Ok(Error::PayeeNotWhitelisted))
    );
    assert_eq!(token.balance(&attacker), 0);

    // Reject: exceeds per-task limit.
    assert_eq!(
        client.try_pay(&3_u64, &payee, &200_i128),
        Err(Ok(Error::ExceedsTaskLimit))
    );

    // Second valid payment accumulates daily + task spend.
    client.pay(&1_u64, &payee, &30_i128);
    assert_eq!(client.task_spent(&1), 80);
    assert_eq!(client.day_spent(), 80);
}

/// The daily limit is enforced even when each individual payment is within the
/// per-task limit. (This path — Error #4 — was previously untested.)
#[test]
fn exceeds_daily_limit_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 100_i128, 60_i128);

    client.add_payee(&payee);
    client.pay(&1_u64, &payee, &60_i128);
    assert_eq!(client.day_spent(), 60);

    // 50 is within per-task (60) but would push the day to 110 > 100 → rejected.
    assert_eq!(
        client.try_pay(&2_u64, &payee, &50_i128),
        Err(Ok(Error::ExceedsDailyLimit))
    );

    // Hitting the daily limit exactly (60 + 40 = 100) is still allowed.
    client.pay(&3_u64, &payee, &40_i128);
    assert_eq!(client.day_spent(), 100);
    assert_eq!(token.balance(&payee), 100);
}

/// The rolling 24h window frees capacity as buckets age out: a full 24 hours
/// after a max-limit spend, the whole allowance is available again.
#[test]
fn daily_window_frees_after_24h() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 100_i128, 100_i128);

    client.add_payee(&payee);
    client.pay(&1_u64, &payee, &100_i128); // lands in the hour-0 bucket
    assert_eq!(client.day_spent(), 100);
    assert_eq!(
        client.try_pay(&2_u64, &payee, &1_i128),
        Err(Ok(Error::ExceedsDailyLimit))
    );

    // The hour-0 bucket falls out once hour 25 starts — a spend is held for a full
    // 24h from when it landed, not from the top of its hour (see
    // `window_never_frees_before_a_full_24h`).
    env.ledger()
        .with_mut(|li| li.timestamp = SECONDS_PER_DAY + 3_600);
    assert_eq!(client.day_spent(), 0);
    client.pay(&3_u64, &payee, &100_i128);
    assert_eq!(client.day_spent(), 100);
    assert_eq!(token.balance(&payee), 200);
}

/// Once a payee is removed from the whitelist, payments to it are rejected.
#[test]
fn rejects_payment_after_payee_removed() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 100_i128);

    client.add_payee(&payee);
    client.pay(&1_u64, &payee, &10_i128);

    client.remove_payee(&payee);
    assert!(!client.is_payee(&payee));
    assert_eq!(
        client.try_pay(&2_u64, &payee, &10_i128),
        Err(Ok(Error::PayeeNotWhitelisted))
    );
}

/// Zero and negative amounts are rejected before any transfer is attempted.
#[test]
fn rejects_zero_and_negative_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 100_i128);

    client.add_payee(&payee);
    assert_eq!(
        client.try_pay(&1_u64, &payee, &0_i128),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        client.try_pay(&2_u64, &payee, &-5_i128),
        Err(Ok(Error::InvalidAmount))
    );
}

/// A payment exactly at the per-task limit is allowed; one unit over is rejected.
#[test]
fn per_task_limit_boundary() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 100_i128);

    client.add_payee(&payee);
    client.pay(&1_u64, &payee, &100_i128);
    assert_eq!(token.balance(&payee), 100);
    assert_eq!(
        client.try_pay(&2_u64, &payee, &101_i128),
        Err(Ok(Error::ExceedsTaskLimit))
    );
}

// --- reputation gate (ERC-8004-style) ------------------------------------------

/// A minimal mock of an ERC-8004 reputation registry: stores a score per agent.
#[contract]
pub struct MockReputation;

#[contractimpl]
impl MockReputation {
    pub fn set_score(env: Env, agent: Address, score: i128) {
        env.storage().persistent().set(&agent, &score);
    }
    pub fn reputation_of(env: Env, agent: Address) -> i128 {
        env.storage().persistent().get(&agent).unwrap_or(0)
    }
}

/// A non-whitelisted payee can be paid once it clears the reputation threshold.
#[test]
fn reputation_gated_payee_allowed() {
    let env = Env::default();
    env.mock_all_auths();
    let (_payee, client, token) = setup(&env, 1000_i128, 100_i128);

    let rep_id = env.register(MockReputation, ());
    let rep = MockReputationClient::new(&env, &rep_id);

    // a brand-new agent, NOT on the whitelist, but reputable
    let reputable = Address::generate(&env);
    rep.set_score(&reputable, &80_i128);

    // turn on the gate: min reputation = 50
    client.set_reputation_policy(&rep_id, &50_i128);
    assert_eq!(client.get_reputation_policy(), Some((rep_id.clone(), 50_i128)));

    // pays even though `reputable` was never whitelisted
    client.pay(&1_u64, &reputable, &40_i128);
    assert_eq!(token.balance(&reputable), 40);
}

/// Below the reputation threshold (and not whitelisted) → rejected.
#[test]
fn below_reputation_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (_payee, client, _token) = setup(&env, 1000_i128, 100_i128);

    let rep_id = env.register(MockReputation, ());
    let rep = MockReputationClient::new(&env, &rep_id);

    let shady = Address::generate(&env);
    rep.set_score(&shady, &10_i128);

    client.set_reputation_policy(&rep_id, &50_i128);

    assert_eq!(
        client.try_pay(&1_u64, &shady, &10_i128),
        Err(Ok(Error::BelowReputationThreshold))
    );
}

/// A whitelisted payee is always allowed — whitelist OR reputation, either suffices.
#[test]
fn whitelisted_payee_bypasses_reputation() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 100_i128);

    // gate on, but `payee` has score 0 in the mock — the whitelist still lets it through
    let rep_id = env.register(MockReputation, ());
    client.set_reputation_policy(&rep_id, &50_i128);

    client.add_payee(&payee);
    client.pay(&1_u64, &payee, &25_i128);
    assert_eq!(token.balance(&payee), 25);
}

// --- escrow: outcome-bound payments --------------------------------------------

/// Lock funds for a payee, then release on approval: payee paid, spend accounted,
/// lock cleared, funds only move at release.
#[test]
fn escrow_lock_and_release() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);

    let id = client.create_escrow(&7_u64, &payee, &60_i128, &SECONDS_PER_DAY);
    assert_eq!(client.locked(), 60);
    assert_eq!(client.balance(), 500); // reserved, not yet moved
    assert_eq!(token.balance(&payee), 0);

    client.release_escrow(&id);
    assert_eq!(token.balance(&payee), 60);
    assert_eq!(client.day_spent(), 60);
    assert_eq!(client.task_spent(&7), 60);
    assert_eq!(client.locked(), 0);
    assert!(client.get_escrow(&id).is_none());
}

/// After the deadline, the agent reclaims an undelivered escrow — funds unlock,
/// nothing is paid out.
#[test]
fn escrow_refund_after_deadline() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);

    let id = client.create_escrow(&1_u64, &payee, &80_i128, &SECONDS_PER_DAY);
    assert_eq!(client.locked(), 80);

    env.ledger().with_mut(|li| li.timestamp = SECONDS_PER_DAY); // reach the deadline
    client.refund_escrow(&id);

    assert_eq!(client.locked(), 0);
    assert_eq!(token.balance(&payee), 0);
    assert_eq!(client.balance(), 500); // funds stayed in the treasury
    assert!(client.get_escrow(&id).is_none());
}

/// Refunding before the deadline is rejected.
#[test]
fn escrow_refund_before_deadline_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);

    let id = client.create_escrow(&1_u64, &payee, &80_i128, &SECONDS_PER_DAY);
    assert_eq!(
        client.try_refund_escrow(&id),
        Err(Ok(Error::DeadlineNotReached))
    );
}

/// Escrow creation honors the same payee gate + per-task limit as a direct payment.
#[test]
fn escrow_create_enforces_per_task_and_payee() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 100_i128);

    // not whitelisted (no reputation policy) → rejected
    assert_eq!(
        client.try_create_escrow(&1_u64, &payee, &50_i128, &SECONDS_PER_DAY),
        Err(Ok(Error::PayeeNotWhitelisted))
    );

    client.add_payee(&payee);
    // over the per-task limit (100) → rejected
    assert_eq!(
        client.try_create_escrow(&2_u64, &payee, &101_i128, &SECONDS_PER_DAY),
        Err(Ok(Error::ExceedsTaskLimit))
    );
}

/// Cannot lock more than the free balance (treasury balance minus already-locked).
#[test]
fn escrow_insufficient_free_balance() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 500_i128);
    client.add_payee(&payee);

    client.create_escrow(&1_u64, &payee, &400_i128, &SECONDS_PER_DAY); // locks 400 → free 100
    assert_eq!(
        client.try_create_escrow(&2_u64, &payee, &200_i128, &SECONDS_PER_DAY),
        Err(Ok(Error::InsufficientFreeBalance))
    );
}

/// pay() must not spend funds reserved by open escrows — the free-balance
/// invariant (balance >= locked) holds on the direct-pay path too, so an
/// accepted escrow can always be honored at release.
#[test]
fn pay_cannot_spend_escrow_locked_funds() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 500_i128);
    client.add_payee(&payee);

    // Reserve 400 of the 500 balance → free = 100.
    let id = client.create_escrow(&1_u64, &payee, &400_i128, &SECONDS_PER_DAY);

    // A direct pay beyond the free balance is rejected (this was the bug).
    assert_eq!(
        client.try_pay(&2_u64, &payee, &150_i128),
        Err(Ok(Error::InsufficientFreeBalance))
    );

    // Exactly the free balance still clears…
    client.pay(&2_u64, &payee, &100_i128);
    assert_eq!(token.balance(&payee), 100);

    // …and the escrow can still be honored afterwards.
    client.release_escrow(&id);
    assert_eq!(token.balance(&payee), 500);
    assert_eq!(client.locked(), 0);
    assert_eq!(client.balance(), 0);
}

// --- auth: the wrong signer can never move funds or mutate policy ---------------

/// Only the registered agent can trigger `pay` — a call signed by anyone else
/// (here: the admin) is rejected by `require_auth` before any effect.
#[test]
fn pay_requires_agent_auth() {
    let env = Env::default();

    let admin = Address::generate(&env);
    let agent = Address::generate(&env);
    let payee = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = sac.address();
    let token_admin = StellarAssetClient::new(&env, &token_addr);
    let token = TokenClient::new(&env, &token_addr);

    let id = env.register(
        Treasury,
        (admin.clone(), agent, token_addr, 1000_i128, 100_i128),
    );
    let client = TreasuryClient::new(&env, &id);

    env.mock_all_auths();
    token_admin.mint(&id, &500_i128);
    client.add_payee(&payee);

    // Sign as the ADMIN — `pay` requires the agent's auth, so the host rejects it.
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &id,
            fn_name: "pay",
            args: (1_u64, payee.clone(), 10_i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    assert!(client.try_pay(&1_u64, &payee, &10_i128).is_err());
    assert_eq!(token.balance(&payee), 0);
    assert_eq!(client.day_spent(), 0);
}

/// Admin-gated mutations reject unauthenticated calls.
#[test]
fn add_payee_requires_admin_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 100_i128);

    // Leave mock mode: with no auths provided, `require_auth` must trap.
    env.set_auths(&[]);
    assert!(client.try_add_payee(&payee).is_err());
    assert!(!client.is_payee(&payee));
}

/// Releasing an escrow is the admin's call — nobody else can trigger the payout.
#[test]
fn release_escrow_requires_admin_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);
    let id = client.create_escrow(&1_u64, &payee, &60_i128, &SECONDS_PER_DAY);

    env.set_auths(&[]);
    assert!(client.try_release_escrow(&id).is_err());
    assert_eq!(client.locked(), 60);
    assert_eq!(token.balance(&payee), 0);
    assert!(client.get_escrow(&id).is_some());
}

// --- escrow lifecycle edges ------------------------------------------------------

/// Unknown escrow ids surface `EscrowNotFound` from both entry points.
#[test]
fn escrow_unknown_id_not_found() {
    let env = Env::default();
    env.mock_all_auths();
    let (_payee, client, _token) = setup(&env, 1000_i128, 100_i128);

    assert_eq!(
        client.try_release_escrow(&999_u64),
        Err(Ok(Error::EscrowNotFound))
    );
    assert_eq!(
        client.try_refund_escrow(&999_u64),
        Err(Ok(Error::EscrowNotFound))
    );
}

/// The daily limit gates `release_escrow` at the real moment of outflow (path #4).
#[test]
fn release_escrow_exceeds_daily_limit() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 100_i128, 100_i128);
    client.add_payee(&payee);

    client.pay(&1_u64, &payee, &60_i128);
    let id = client.create_escrow(&2_u64, &payee, &50_i128, &SECONDS_PER_DAY);
    assert_eq!(
        client.try_release_escrow(&id),
        Err(Ok(Error::ExceedsDailyLimit))
    );

    // Once the earlier spend ages out of the window the allowance is whole again
    // and the release clears.
    env.ledger()
        .with_mut(|li| li.timestamp = SECONDS_PER_DAY + 3_600);
    client.release_escrow(&id);
    assert_eq!(client.day_spent(), 50);
    assert_eq!(token.balance(&payee), 110);
}

/// A released escrow is gone — a second release cannot double-pay.
#[test]
fn escrow_double_release_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);

    let id = client.create_escrow(&1_u64, &payee, &60_i128, &SECONDS_PER_DAY);
    client.release_escrow(&id);
    assert_eq!(
        client.try_release_escrow(&id),
        Err(Ok(Error::EscrowNotFound))
    );
    assert_eq!(token.balance(&payee), 60);
    assert_eq!(client.locked(), 0);
}

/// A refunded escrow cannot be released afterwards.
#[test]
fn escrow_release_after_refund_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);

    let id = client.create_escrow(&1_u64, &payee, &80_i128, &SECONDS_PER_DAY);
    env.ledger().with_mut(|li| li.timestamp = SECONDS_PER_DAY);
    client.refund_escrow(&id);

    assert_eq!(
        client.try_release_escrow(&id),
        Err(Ok(Error::EscrowNotFound))
    );
    assert_eq!(client.balance(), 500);
    assert_eq!(token.balance(&payee), 0);
}

/// The reputation gate is inclusive: a score exactly at the threshold clears,
/// one point below is rejected (`score >= min`).
#[test]
fn reputation_exact_threshold_allowed() {
    let env = Env::default();
    env.mock_all_auths();
    let (_payee, client, token) = setup(&env, 1000_i128, 100_i128);

    let rep_id = env.register(MockReputation, ());
    let rep = MockReputationClient::new(&env, &rep_id);
    client.set_reputation_policy(&rep_id, &50_i128);

    let exact = Address::generate(&env);
    rep.set_score(&exact, &50_i128);
    client.pay(&1_u64, &exact, &10_i128);
    assert_eq!(token.balance(&exact), 10);

    let below = Address::generate(&env);
    rep.set_score(&below, &49_i128);
    assert_eq!(
        client.try_pay(&2_u64, &below, &10_i128),
        Err(Ok(Error::BelowReputationThreshold))
    );
}

/// Direct pays and escrow releases fill the same daily allowance.
#[test]
fn pay_and_release_share_daily_limit() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 100_i128, 100_i128);
    client.add_payee(&payee);

    client.pay(&1_u64, &payee, &60_i128);
    let id = client.create_escrow(&2_u64, &payee, &40_i128, &SECONDS_PER_DAY);
    client.release_escrow(&id); // 60 + 40 == 100 — exactly at the limit
    assert_eq!(client.day_spent(), 100);
    assert_eq!(token.balance(&payee), 100);

    assert_eq!(
        client.try_pay(&3_u64, &payee, &1_i128),
        Err(Ok(Error::ExceedsDailyLimit))
    );
}

// --- M2: rolling 24h window ------------------------------------------------------

/// SECURITY.md C2 closure proof: spending the full limit just before UTC midnight
/// no longer allows another full limit just after it — the window rolls with time
/// instead of resetting at a calendar boundary.
#[test]
fn c2_day_boundary_no_longer_doubles() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 100_i128, 100_i128);
    client.add_payee(&payee);

    env.ledger().with_mut(|li| li.timestamp = 84_600); // 23:30 UTC
    client.pay(&1_u64, &payee, &100_i128);

    env.ledger().with_mut(|li| li.timestamp = 88_200); // 00:30 UTC, next calendar day
    assert_eq!(
        client.try_pay(&2_u64, &payee, &1_i128),
        Err(Ok(Error::ExceedsDailyLimit))
    );
    assert_eq!(client.day_spent(), 100); // the pre-midnight spend is still in the window
}

/// Buckets age out individually — the oldest spend frees capacity first.
#[test]
fn partial_window_drains_oldest_bucket_first() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 100_i128, 100_i128);
    client.add_payee(&payee);

    client.pay(&1_u64, &payee, &60_i128); // hour-0 bucket
    env.ledger().with_mut(|li| li.timestamp = 5 * 3_600);
    client.pay(&2_u64, &payee, &40_i128); // hour-5 bucket — window is now full
    assert_eq!(
        client.try_pay(&3_u64, &payee, &1_i128),
        Err(Ok(Error::ExceedsDailyLimit))
    );

    // At hour 25 the hour-0 bucket (60) drops out; only the hour-5 bucket (40) remains.
    env.ledger().with_mut(|li| li.timestamp = 25 * 3_600);
    assert_eq!(client.day_spent(), 40);
    client.pay(&4_u64, &payee, &60_i128);
    assert_eq!(
        client.try_pay(&5_u64, &payee, &1_i128),
        Err(Ok(Error::ExceedsDailyLimit))
    );
}

/// day_spent() spans calendar days — a late-night spend is still visible after
/// midnight (the view reports the rolling window, not a UTC-day counter).
#[test]
fn rolling_window_spans_calendar_days() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 100_i128, 100_i128);
    client.add_payee(&payee);

    env.ledger().with_mut(|li| li.timestamp = 84_600); // 23:30 UTC
    client.pay(&1_u64, &payee, &50_i128);

    env.ledger().with_mut(|li| li.timestamp = 90_000); // 01:00 UTC next day
    assert_eq!(client.day_spent(), 50);
}

/// The window must never be SHORTER than 24h.
///
/// Spend is charged to the bucket of the hour it lands in, so summing 24 buckets
/// released a spend made at the last second of an hour after 23h00m01s — a
/// compromised agent could spend 2x the daily limit inside one wall-clock day.
/// Summing 25 buckets makes the window 24-25h: conservative in the safe direction.
#[test]
fn window_never_frees_before_a_full_24h() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 100_i128, 100_i128);
    client.add_payee(&payee);

    env.ledger().with_mut(|li| li.timestamp = 3_599); // last second of hour 0
    client.pay(&1_u64, &payee, &100_i128);

    // Exactly 24h after the spend it must still be inside the window.
    env.ledger()
        .with_mut(|li| li.timestamp = 3_599 + SECONDS_PER_DAY);
    assert_eq!(client.day_spent(), 100);
    assert_eq!(
        client.try_pay(&2_u64, &payee, &1_i128),
        Err(Ok(Error::ExceedsDailyLimit))
    );

    // An hour later it has aged out and the allowance is whole again.
    env.ledger()
        .with_mut(|li| li.timestamp = 3_599 + SECONDS_PER_DAY + 3_600);
    assert_eq!(client.day_spent(), 0);
    client.pay(&3_u64, &payee, &100_i128);
}

// --- M2: session — time-bound, spend-capped agent credential ---------------------

/// A session agent pays within its cap; the session's spent counter is charged.
#[test]
fn session_agent_pays_within_cap_and_charges_spent() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);

    let sess = Address::generate(&env);
    client.set_session(&sess, &3_600_u64, &100_i128);
    client.pay(&1_u64, &payee, &60_i128);

    let s = client.get_session().unwrap();
    assert_eq!(s.spent, 60);
    assert_eq!(client.day_spent(), 60);
    assert_eq!(token.balance(&payee), 60);
}

/// Single-spender rule: while a session is active, the ROOT agent's signature
/// no longer authorises payments — the session agent is the only spender.
#[test]
fn session_replaces_root_agent() {
    let env = Env::default();

    let admin = Address::generate(&env);
    let agent = Address::generate(&env);
    let payee = Address::generate(&env);
    let sess = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = sac.address();
    let token_admin = StellarAssetClient::new(&env, &token_addr);
    let token = TokenClient::new(&env, &token_addr);

    let id = env.register(
        Treasury,
        (admin.clone(), agent.clone(), token_addr, 1000_i128, 100_i128),
    );
    let client = TreasuryClient::new(&env, &id);

    env.mock_all_auths();
    token_admin.mint(&id, &500_i128);
    client.add_payee(&payee);
    client.set_session(&sess, &3_600_u64, &100_i128);

    // Only the ROOT agent signs — rejected, because the active session replaces it.
    env.mock_auths(&[MockAuth {
        address: &agent,
        invoke: &MockAuthInvoke {
            contract: &id,
            fn_name: "pay",
            args: (1_u64, payee.clone(), 10_i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    assert!(client.try_pay(&1_u64, &payee, &10_i128).is_err());
    assert_eq!(token.balance(&payee), 0);

    // The session agent's signature clears.
    env.mock_auths(&[MockAuth {
        address: &sess,
        invoke: &MockAuthInvoke {
            contract: &id,
            fn_name: "pay",
            args: (1_u64, payee.clone(), 10_i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.pay(&1_u64, &payee, &10_i128);
    assert_eq!(token.balance(&payee), 10);
}

/// The session cap binds even when the daily window has plenty of room.
#[test]
fn session_cap_enforced() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);

    let sess = Address::generate(&env);
    client.set_session(&sess, &3_600_u64, &100_i128);
    client.pay(&1_u64, &payee, &60_i128);
    assert_eq!(
        client.try_pay(&2_u64, &payee, &50_i128),
        Err(Ok(Error::ExceedsSessionLimit))
    );
}

/// When the session expires (ts == valid_until is already expired), spending
/// falls back to the root agent and the stale session is no longer charged.
#[test]
fn session_expiry_falls_back_to_root_agent() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);

    let sess = Address::generate(&env);
    client.set_session(&sess, &3_600_u64, &50_i128);
    client.pay(&1_u64, &payee, &30_i128); // charges the session (spent = 30)

    env.ledger().with_mut(|li| li.timestamp = 3_600); // exactly valid_until → inactive
    client.pay(&2_u64, &payee, &60_i128); // above the (now inactive) session cap — root pays
    assert_eq!(token.balance(&payee), 90);
    assert_eq!(client.get_session().unwrap().spent, 30); // stale session untouched
}

/// Revocation is instant — the session disappears and the root agent is back.
#[test]
fn revoke_session_is_instant() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);

    let sess = Address::generate(&env);
    client.set_session(&sess, &3_600_u64, &100_i128);
    assert!(client.get_session().is_some());

    client.revoke_session();
    assert!(client.get_session().is_none());
    client.pay(&1_u64, &payee, &10_i128); // root agent spends again
    assert_eq!(token.balance(&payee), 10);
}

/// Setting a new session overwrites the old one and resets its spent counter.
#[test]
fn set_session_rotation_resets_spent() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);

    let a = Address::generate(&env);
    let b = Address::generate(&env);
    client.set_session(&a, &3_600_u64, &100_i128);
    client.pay(&1_u64, &payee, &60_i128);
    assert_eq!(client.get_session().unwrap().spent, 60);

    client.set_session(&b, &7_200_u64, &100_i128);
    let s = client.get_session().unwrap();
    assert_eq!(s.agent, b);
    assert_eq!(s.spent, 0);
}

/// Escrow creation charges the session cap at commitment time, and a refund
/// does NOT restore the session budget (the cap bounds what a session may commit).
#[test]
fn create_escrow_charges_session_cap_and_refund_keeps_it() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 500_i128);
    client.add_payee(&payee);

    let sess = Address::generate(&env);
    client.set_session(&sess, &(2 * SECONDS_PER_DAY), &100_i128);

    let id = client.create_escrow(&1_u64, &payee, &70_i128, &SECONDS_PER_DAY);
    assert_eq!(client.get_session().unwrap().spent, 70);
    assert_eq!(
        client.try_pay(&2_u64, &payee, &40_i128),
        Err(Ok(Error::ExceedsSessionLimit))
    );

    env.ledger().with_mut(|li| li.timestamp = SECONDS_PER_DAY);
    client.refund_escrow(&id);
    assert_eq!(client.get_session().unwrap().spent, 70); // not restored
    assert_eq!(
        client.try_pay(&3_u64, &payee, &40_i128),
        Err(Ok(Error::ExceedsSessionLimit))
    );
}

/// set_session validates its inputs: non-positive caps and past expiries are invalid.
#[test]
fn set_session_rejects_invalid() {
    let env = Env::default();
    env.mock_all_auths();
    let (_payee, client, _token) = setup(&env, 1000_i128, 100_i128);

    let sess = Address::generate(&env);
    assert_eq!(
        client.try_set_session(&sess, &3_600_u64, &0_i128),
        Err(Ok(Error::InvalidLimits))
    );
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    assert_eq!(
        client.try_set_session(&sess, &1_000_u64, &10_i128), // valid_until == now
        Err(Ok(Error::InvalidLimits))
    );
}

/// Session management is the admin's call.
#[test]
fn session_management_requires_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let (_payee, client, _token) = setup(&env, 1000_i128, 100_i128);
    let sess = Address::generate(&env);

    env.set_auths(&[]);
    assert!(client.try_set_session(&sess, &3_600_u64, &100_i128).is_err());
    assert!(client.try_revoke_session().is_err());
}

// --- M2: lifecycle ----------------------------------------------------------------

/// Pause freezes every spending path: pay, create_escrow, release_escrow.
#[test]
fn pause_blocks_spending_paths() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);
    let id = client.create_escrow(&1_u64, &payee, &50_i128, &SECONDS_PER_DAY);

    client.set_paused(&true);
    assert!(client.is_paused());
    assert_eq!(client.try_pay(&2_u64, &payee, &10_i128), Err(Ok(Error::Paused)));
    assert_eq!(
        client.try_create_escrow(&3_u64, &payee, &10_i128, &SECONDS_PER_DAY),
        Err(Ok(Error::Paused))
    );
    assert_eq!(client.try_release_escrow(&id), Err(Ok(Error::Paused)));
}

/// Exit paths are never locked: refund, withdraw, and admin setters work while paused.
#[test]
fn pause_never_blocks_refund_and_withdraw() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);
    let id = client.create_escrow(&1_u64, &payee, &80_i128, &SECONDS_PER_DAY);

    client.set_paused(&true);

    let out = Address::generate(&env);
    client.admin_withdraw(&out, &100_i128); // free balance = 500 - 80 locked
    assert_eq!(token.balance(&out), 100);

    env.ledger().with_mut(|li| li.timestamp = SECONDS_PER_DAY);
    client.refund_escrow(&id);
    assert_eq!(client.locked(), 0);

    client.set_limits(&200_i128, &50_i128); // admin setters keep working too
}

/// Unpausing restores spending.
#[test]
fn unpause_restores_spending() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);

    client.set_paused(&true);
    assert_eq!(client.try_pay(&1_u64, &payee, &10_i128), Err(Ok(Error::Paused)));
    client.set_paused(&false);
    client.pay(&1_u64, &payee, &10_i128);
    assert_eq!(token.balance(&payee), 10);
}

/// Withdraw honors the escrow lock and rejects non-positive amounts.
#[test]
fn admin_withdraw_respects_locked_balance() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 500_i128);
    client.add_payee(&payee);
    client.create_escrow(&1_u64, &payee, &400_i128, &SECONDS_PER_DAY); // free = 100

    let out = Address::generate(&env);
    assert_eq!(
        client.try_admin_withdraw(&out, &200_i128),
        Err(Ok(Error::InsufficientFreeBalance))
    );
    assert_eq!(
        client.try_admin_withdraw(&out, &0_i128),
        Err(Ok(Error::InvalidAmount))
    );
    client.admin_withdraw(&out, &100_i128);
    assert_eq!(token.balance(&out), 100);
}

/// Withdraw is the owner's own money leaving with the owner's own signature —
/// it consumes no window allowance and needs no whitelisting.
#[test]
fn admin_withdraw_not_counted_in_window_or_payee_gate() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 100_i128, 100_i128);
    client.add_payee(&payee);

    let out = Address::generate(&env); // NOT whitelisted — and that's fine
    client.admin_withdraw(&out, &200_i128);
    assert_eq!(token.balance(&out), 200);
    assert_eq!(client.day_spent(), 0);

    client.pay(&1_u64, &payee, &100_i128); // the full allowance is still available
    assert_eq!(client.day_spent(), 100);
}

/// set_limits validates and applies immediately.
#[test]
fn set_limits_validates_and_applies() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);

    assert_eq!(
        client.try_set_limits(&100_i128, &200_i128), // per-task above daily
        Err(Ok(Error::InvalidLimits))
    );
    assert_eq!(
        client.try_set_limits(&0_i128, &0_i128),
        Err(Ok(Error::InvalidLimits))
    );

    client.set_limits(&50_i128, &30_i128);
    let cfg = client.get_config();
    assert_eq!(cfg.daily_limit, 50);
    assert_eq!(cfg.per_task_limit, 30);
    assert_eq!(
        client.try_pay(&1_u64, &payee, &40_i128), // over the NEW per-task limit
        Err(Ok(Error::ExceedsTaskLimit))
    );
    client.pay(&2_u64, &payee, &30_i128);
}

/// Rotating the root agent: the old key stops working, the new one spends.
#[test]
fn set_agent_rotates_root() {
    let env = Env::default();

    let admin = Address::generate(&env);
    let agent = Address::generate(&env);
    let new_agent = Address::generate(&env);
    let payee = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = sac.address();
    let token_admin = StellarAssetClient::new(&env, &token_addr);
    let token = TokenClient::new(&env, &token_addr);

    let id = env.register(
        Treasury,
        (admin.clone(), agent.clone(), token_addr, 1000_i128, 100_i128),
    );
    let client = TreasuryClient::new(&env, &id);

    env.mock_all_auths();
    token_admin.mint(&id, &500_i128);
    client.add_payee(&payee);
    client.set_agent(&new_agent);
    assert_eq!(client.get_config().agent, new_agent);

    // The OLD agent's signature no longer authorises payments…
    env.mock_auths(&[MockAuth {
        address: &agent,
        invoke: &MockAuthInvoke {
            contract: &id,
            fn_name: "pay",
            args: (1_u64, payee.clone(), 10_i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    assert!(client.try_pay(&1_u64, &payee, &10_i128).is_err());

    // …the new one does.
    env.mock_auths(&[MockAuth {
        address: &new_agent,
        invoke: &MockAuthInvoke {
            contract: &id,
            fn_name: "pay",
            args: (1_u64, payee.clone(), 10_i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.pay(&1_u64, &payee, &10_i128);
    assert_eq!(token.balance(&payee), 10);
}

/// Every lifecycle mutation is admin-gated.
#[test]
fn lifecycle_fns_require_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let (_payee, client, _token) = setup(&env, 1000_i128, 100_i128);
    let out = Address::generate(&env);

    env.set_auths(&[]);
    assert!(client.try_set_paused(&true).is_err());
    assert!(client.try_admin_withdraw(&out, &10_i128).is_err());
    assert!(client.try_set_limits(&50_i128, &10_i128).is_err());
    assert!(client.try_set_agent(&out).is_err());
}

/// Escrow deadlines must be in the future — a past deadline would be an instant
/// no-op refund that still burns session budget.
#[test]
fn escrow_rejects_past_deadline() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);

    env.ledger().with_mut(|li| li.timestamp = 1_000);
    assert_eq!(
        client.try_create_escrow(&1_u64, &payee, &50_i128, &1_000_u64), // deadline == now
        Err(Ok(Error::InvalidDeadline))
    );
    assert_eq!(
        client.try_create_escrow(&1_u64, &payee, &50_i128, &500_u64), // deadline < now
        Err(Ok(Error::InvalidDeadline))
    );
    client.create_escrow(&1_u64, &payee, &50_i128, &2_000_u64); // future — fine
}

/// The admin can unilaterally cancel an open escrow: the lock returns to the free
/// balance, nobody gets paid, and no deadline is needed — the incident-response
/// path against a compromised agent locking up the treasury.
#[test]
fn admin_cancel_escrow_unlocks_without_paying() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 500_i128);
    client.add_payee(&payee);

    let id = client.create_escrow(&1_u64, &payee, &400_i128, &SECONDS_PER_DAY);
    assert_eq!(client.locked(), 400);

    client.admin_cancel_escrow(&id);
    assert_eq!(client.locked(), 0);
    assert_eq!(token.balance(&payee), 0); // nothing paid
    assert_eq!(client.balance(), 500); // funds stayed in the treasury
    assert!(client.get_escrow(&id).is_none());

    // The freed funds are immediately withdrawable by the owner.
    let out = Address::generate(&env);
    client.admin_withdraw(&out, &500_i128);
    assert_eq!(token.balance(&out), 500);
}

/// Cancel is admin-gated, works while paused, and surfaces EscrowNotFound.
#[test]
fn admin_cancel_works_while_paused_and_requires_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);
    let id = client.create_escrow(&1_u64, &payee, &60_i128, &SECONDS_PER_DAY);

    assert_eq!(
        client.try_admin_cancel_escrow(&999_u64),
        Err(Ok(Error::EscrowNotFound))
    );

    client.set_paused(&true);
    client.admin_cancel_escrow(&id); // exit paths never lock
    assert_eq!(client.locked(), 0);

    let id2_setup = || {
        client.set_paused(&false);
        let id2 = client.create_escrow(&2_u64, &payee, &10_i128, &SECONDS_PER_DAY);
        id2
    };
    let id2 = id2_setup();
    env.set_auths(&[]);
    assert!(client.try_admin_cancel_escrow(&id2).is_err()); // not without the admin
}

// --- M2: constructor validation ---------------------------------------------------

/// A treasury can never exist with a self-contradicting policy (C5 closure).
#[test]
#[should_panic]
fn constructor_rejects_per_task_above_daily() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let agent = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    env.register(Treasury, (admin, agent, sac.address(), 100_i128, 200_i128));
}

// --- v3.2: instance TTL, cancel-vs-session, fail-closed registry ------------------

/// Every mutation extends the instance storage TTL (via `bump_instance`) so a low-activity
/// treasury's core policy can't be archived out from under it — audit finding C3. Proven
/// here through set_paused; pay/create_escrow/etc. call the identical helper.
#[test]
fn mutation_extends_instance_ttl() {
    let env = Env::default();
    env.mock_all_auths();
    let (_payee, client, _token) = setup(&env, 1000_i128, 100_i128);
    let addr = client.address.clone();

    // The constructor already bumped the instance TTL to EXTEND_TO. Advance the ledger so
    // only a sliver of TTL remains — below the extend threshold…
    let ttl0 = env.as_contract(&addr, || env.storage().instance().get_ttl());
    env.ledger().with_mut(|li| li.sequence_number += ttl0 - 100);
    let ttl_before = env.as_contract(&addr, || env.storage().instance().get_ttl());
    assert!(ttl_before < INSTANCE_TTL_THRESHOLD);

    // …then a mutation must bump it back up toward EXTEND_TO.
    client.set_paused(&true);
    let ttl_after = env.as_contract(&addr, || env.storage().instance().get_ttl());
    assert!(ttl_after > ttl_before);
    assert!(ttl_after >= INSTANCE_TTL_EXTEND_TO - 1);
}

/// admin_cancel_escrow releases the lock but, exactly like refund, does NOT restore the
/// session budget — the cap bounds what a session may commit, cancelled or not.
#[test]
fn admin_cancel_escrow_does_not_restore_session_budget() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 500_i128);
    client.add_payee(&payee);

    let sess = Address::generate(&env);
    client.set_session(&sess, &(2 * SECONDS_PER_DAY), &100_i128);

    let id = client.create_escrow(&1_u64, &payee, &70_i128, &SECONDS_PER_DAY);
    assert_eq!(client.get_session().unwrap().spent, 70);

    client.admin_cancel_escrow(&id);
    assert_eq!(client.locked(), 0); // lock returned to the free balance
    assert_eq!(client.get_session().unwrap().spent, 70); // budget NOT restored
    assert_eq!(
        client.try_pay(&2_u64, &payee, &40_i128),
        Err(Ok(Error::ExceedsSessionLimit))
    );
}

/// A reputation registry that traps when read — used to prove the treasury fails closed.
#[contract]
pub struct BrokenReputation;

#[contractimpl]
impl BrokenReputation {
    pub fn reputation_of(_env: Env, _agent: Address) -> i128 {
        panic!("registry unavailable");
    }
}

/// If the reputation registry is unreachable (its call traps), `pay` must fail closed —
/// the payment reverts and no funds move — rather than paying an unvetted payee.
#[test]
fn pay_fails_closed_when_registry_traps() {
    let env = Env::default();
    env.mock_all_auths();
    let (_payee, client, token) = setup(&env, 1000_i128, 100_i128);

    let broken = env.register(BrokenReputation, ());
    client.set_reputation_policy(&broken, &1_i128);

    // A non-whitelisted payee forces the reputation path → the registry traps.
    let stranger = Address::generate(&env);
    assert!(client.try_pay(&1_u64, &stranger, &10_i128).is_err());
    assert_eq!(token.balance(&stranger), 0); // nothing paid
    assert_eq!(client.day_spent(), 0); // no spend recorded
}
