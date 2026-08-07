#![cfg(test)]
use super::*;
use soroban_sdk::testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke};
use soroban_sdk::{contract, contractimpl, Address, Bytes, BytesN, Env, IntoVal};

// Binary fixtures emitted by packages/prover (one encoder, shared with the live call).
const PROOF: &[u8] = include_bytes!("../fixtures/proof.bin");
const PUBLIC: &[u8] = include_bytes!("../fixtures/public.bin");

// public_bytes layout (5 header field elements x 32 bytes, then one per batch slot):
//   [dailyLimit(0..32), perTaskLimit(32..64), whitelistRoot(64..96), periodId(96..128),
//    periodSpent(128..160), commitments(160..)]
//
// Tests that tamper with a signal copy PUBLIC rather than declaring a byte length, so the
// batch size can change without leaving a stale constant behind that silently turns a
// should_panic test into one that passes for the wrong reason.
const PUBLIC_LEN: usize = PUBLIC.len();

/// The fixture's own claims, read back out of the bytes rather than hard-coded — if the
/// sample batch is ever regenerated with different numbers, these tests follow it.
struct Fixture {
    daily: i128,
    per_task: i128,
    root: BytesN<32>,
    period: u64,
    spent: i128,
}

fn field(env: &Env, off: u32) -> BytesN<32> {
    Bytes::from_slice(env, PUBLIC)
        .slice(off..off + 32)
        .try_into()
        .unwrap()
}

fn as_i128(v: &BytesN<32>) -> i128 {
    let b = v.to_array();
    let mut arr = [0u8; 16];
    arr.copy_from_slice(&b[16..32]);
    i128::from_be_bytes(arr)
}

fn fixture(env: &Env) -> Fixture {
    Fixture {
        daily: as_i128(&field(env, 0)),
        per_task: as_i128(&field(env, 32)),
        root: field(env, 64),
        period: as_i128(&field(env, 96)) as u64,
        spent: as_i128(&field(env, 128)),
    }
}

// --- a stand-in for the treasury the verifier reads its facts from -------------------
//
// The verifier's whole job is now to disbelieve the proof and believe the chain, so the
// tests need a chain that can be made to say something other than what the proof claims.

#[contracttype]
#[derive(Clone)]
pub struct MockState {
    pub admin: Address,
    pub daily_limit: i128,
    pub per_task_limit: i128,
    pub root: Option<BytesN<32>>,
    pub period: u64,
    pub spent: i128,
}

#[contract]
pub struct MockTreasury;

#[contractimpl]
impl MockTreasury {
    pub fn __constructor(env: Env, state: MockState) {
        env.storage().instance().set(&symbol_short!("state"), &state);
    }

    pub fn get_config(env: Env) -> TreasuryConfig {
        let s: MockState = env.storage().instance().get(&symbol_short!("state")).unwrap();
        TreasuryConfig {
            admin: s.admin.clone(),
            agent: s.admin.clone(),
            token: s.admin,
            daily_limit: s.daily_limit,
            per_task_limit: s.per_task_limit,
        }
    }

    pub fn period_spent(env: Env, period_id: u64) -> i128 {
        let s: MockState = env.storage().instance().get(&symbol_short!("state")).unwrap();
        if period_id == s.period {
            s.spent
        } else {
            0
        }
    }

    pub fn whitelist_root(env: Env) -> Option<BytesN<32>> {
        let s: MockState = env.storage().instance().get(&symbol_short!("state")).unwrap();
        s.root
    }
}

/// A treasury whose on-chain state agrees with the fixture in every respect, plus a
/// verifier and a clock parked one day after the proved period (so it is closed but
/// still inside the lookback window).
fn honest_setup(env: &Env) -> (Address, Address, ComplianceVerifierClient<'_>, Fixture) {
    let f = fixture(env);
    let admin = Address::generate(env);
    let treasury = deploy_mock(
        env,
        MockState {
            admin: admin.clone(),
            daily_limit: f.daily,
            per_task_limit: f.per_task,
            root: Some(f.root.clone()),
            period: f.period,
            spent: f.spent,
        },
    );
    let verifier = env.register(ComplianceVerifier, ());
    let client = ComplianceVerifierClient::new(env, &verifier);
    env.ledger()
        .with_mut(|li| li.timestamp = (f.period + 1) * 86_400);
    (admin, treasury, client, f)
}

fn deploy_mock(env: &Env, state: MockState) -> Address {
    env.register(MockTreasury, (state,))
}

fn proof(env: &Env) -> Bytes {
    Bytes::from_slice(env, PROOF)
}

fn public(env: &Env) -> Bytes {
    Bytes::from_slice(env, PUBLIC)
}

#[test]
fn valid_proof_attests_and_advances_the_period() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, treasury, client, f) = honest_setup(&env);

    client.verify(&treasury, &proof(&env), &public(&env));

    assert_eq!(client.last_period(&treasury), Some(f.period));
}

// --- H1: the binding this contract exists for ---------------------------------------
//
// The 2026-08-05 audit produced a valid attestation from a batch that never happened.
// The proof below IS valid — it is the real fixture — but the treasury reports a
// different total for the period, so the batch it describes is not the period's actual
// spending. That has to be refused, or attestations mean nothing again.

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn rejects_a_batch_that_is_not_what_the_treasury_spent() {
    let env = Env::default();
    env.mock_all_auths();
    let f = fixture(&env);
    let admin = Address::generate(&env);
    let treasury = deploy_mock(
        &env,
        MockState {
            admin,
            daily_limit: f.daily,
            per_task_limit: f.per_task,
            root: Some(f.root.clone()),
            period: f.period,
            spent: f.spent + 1, // the chain saw one unit more than the batch accounts for
        },
    );
    let verifier = env.register(ComplianceVerifier, ());
    let client = ComplianceVerifierClient::new(&env, &verifier);
    env.ledger()
        .with_mut(|li| li.timestamp = (f.period + 1) * 86_400);

    client.verify(&treasury, &proof(&env), &public(&env));
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn rejects_a_proof_aimed_at_a_treasury_that_never_spent() {
    let env = Env::default();
    env.mock_all_auths();
    let f = fixture(&env);
    let admin = Address::generate(&env);
    // Same policy, but nothing happened in that period — `period_spent` returns 0.
    let treasury = deploy_mock(
        &env,
        MockState {
            admin,
            daily_limit: f.daily,
            per_task_limit: f.per_task,
            root: Some(f.root.clone()),
            period: f.period + 99,
            spent: f.spent,
        },
    );
    let verifier = env.register(ComplianceVerifier, ());
    let client = ComplianceVerifierClient::new(&env, &verifier);
    env.ledger()
        .with_mut(|li| li.timestamp = (f.period + 1) * 86_400);

    client.verify(&treasury, &proof(&env), &public(&env));
}

// --- policy has to come from the treasury, not from the proof -----------------------

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn rejects_a_policy_the_treasury_does_not_hold() {
    let env = Env::default();
    env.mock_all_auths();
    let f = fixture(&env);
    let admin = Address::generate(&env);
    let treasury = deploy_mock(
        &env,
        MockState {
            admin,
            daily_limit: f.daily + 1, // proof claims a limit this treasury never set
            per_task_limit: f.per_task,
            root: Some(f.root.clone()),
            period: f.period,
            spent: f.spent,
        },
    );
    let verifier = env.register(ComplianceVerifier, ());
    let client = ComplianceVerifierClient::new(&env, &verifier);
    env.ledger()
        .with_mut(|li| li.timestamp = (f.period + 1) * 86_400);

    client.verify(&treasury, &proof(&env), &public(&env));
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn rejects_a_whitelist_root_the_treasury_did_not_publish() {
    let env = Env::default();
    env.mock_all_auths();
    let f = fixture(&env);
    let admin = Address::generate(&env);
    let treasury = deploy_mock(
        &env,
        MockState {
            admin,
            daily_limit: f.daily,
            per_task_limit: f.per_task,
            root: Some(BytesN::from_array(&env, &[0xAB; 32])),
            period: f.period,
            spent: f.spent,
        },
    );
    let verifier = env.register(ComplianceVerifier, ());
    let client = ComplianceVerifierClient::new(&env, &verifier);
    env.ledger()
        .with_mut(|li| li.timestamp = (f.period + 1) * 86_400);

    client.verify(&treasury, &proof(&env), &public(&env));
}

/// A treasury that never declared a payee set has no allowlist to be judged against, so
/// the attestation would be an assertion about nothing.
#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn rejects_a_treasury_with_no_published_root() {
    let env = Env::default();
    env.mock_all_auths();
    let f = fixture(&env);
    let admin = Address::generate(&env);
    let treasury = deploy_mock(
        &env,
        MockState {
            admin,
            daily_limit: f.daily,
            per_task_limit: f.per_task,
            root: None,
            period: f.period,
            spent: f.spent,
        },
    );
    let verifier = env.register(ComplianceVerifier, ());
    let client = ComplianceVerifierClient::new(&env, &verifier);
    env.ledger()
        .with_mut(|li| li.timestamp = (f.period + 1) * 86_400);

    client.verify(&treasury, &proof(&env), &public(&env));
}

/// The circuit compares against LessEqThan(68)/LessEqThan(64). A treasury whose limits
/// outgrew those comparators cannot be judged by this circuit at all — and since
/// `set_limits` can widen them after deploy, the check belongs here, not in a constructor.
#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn rejects_limits_wider_than_the_circuit_comparators() {
    let env = Env::default();
    env.mock_all_auths();
    let f = fixture(&env);
    let admin = Address::generate(&env);
    let wide = 1_i128 << 68;
    let treasury = deploy_mock(
        &env,
        MockState {
            admin,
            daily_limit: wide,
            per_task_limit: f.per_task,
            root: Some(f.root.clone()),
            period: f.period,
            spent: f.spent,
        },
    );
    let verifier = env.register(ComplianceVerifier, ());
    let client = ComplianceVerifierClient::new(&env, &verifier);
    env.ledger()
        .with_mut(|li| li.timestamp = (f.period + 1) * 86_400);

    // Public signals carry the wide limit too, so this is past the policy comparison.
    let mut bytes = [0u8; PUBLIC_LEN];
    bytes.copy_from_slice(PUBLIC);
    bytes[16..32].copy_from_slice(&wide.to_be_bytes());
    client.verify(&treasury, &proof(&env), &Bytes::from_slice(&env, &bytes));
}

// --- the period has to be closed, recent, and new -----------------------------------

/// An open period's total is still moving, so proving it asserts nothing durable.
#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn rejects_a_period_that_has_not_closed_yet() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, treasury, client, f) = honest_setup(&env);
    env.ledger().with_mut(|li| li.timestamp = f.period * 86_400 + 5);

    client.verify(&treasury, &proof(&env), &public(&env));
}

/// Far enough back, the hourly buckets `period_spent` sums may already be archived and
/// would read as zero — a stale period would look cheaper than it was.
#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn rejects_a_period_older_than_the_lookback_window() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, treasury, client, f) = honest_setup(&env);
    env.ledger()
        .with_mut(|li| li.timestamp = (f.period + MAX_PERIOD_LOOKBACK + 1) * 86_400);

    client.verify(&treasury, &proof(&env), &public(&env));
}

/// Replay, and back-filling generally: periods only move forward. Attesting to period 5
/// forecloses period 3, so an owner cannot publish only the flattering stretches.
#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn rejects_a_period_already_attested() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, treasury, client, _f) = honest_setup(&env);

    client.verify(&treasury, &proof(&env), &public(&env)); // 1st: attests
    client.verify(&treasury, &proof(&env), &public(&env)); // 2nd: same period
}

/// Two treasuries keep separate period counters — one attesting must not foreclose the
/// other's identical period.
#[test]
fn period_bookkeeping_is_per_treasury() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, treasury_a, client, f) = honest_setup(&env);

    let admin_b = Address::generate(&env);
    let treasury_b = deploy_mock(
        &env,
        MockState {
            admin: admin_b,
            daily_limit: f.daily,
            per_task_limit: f.per_task,
            root: Some(f.root.clone()),
            period: f.period,
            spent: f.spent,
        },
    );

    client.verify(&treasury_a, &proof(&env), &public(&env));
    client.verify(&treasury_b, &proof(&env), &public(&env));

    assert_eq!(client.last_period(&treasury_a), Some(f.period));
    assert_eq!(client.last_period(&treasury_b), Some(f.period));
}

/// Only the treasury's own owner may attest for it. Without this the verifier is an open
/// endpoint anyone can push events through on someone else's behalf.
#[test]
#[should_panic]
fn rejects_a_caller_who_is_not_the_treasury_admin() {
    let env = Env::default();
    let f = fixture(&env);
    let admin = Address::generate(&env);
    let stranger = Address::generate(&env);
    let treasury = deploy_mock(
        &env,
        MockState {
            admin: admin.clone(),
            daily_limit: f.daily,
            per_task_limit: f.per_task,
            root: Some(f.root.clone()),
            period: f.period,
            spent: f.spent,
        },
    );
    let verifier = env.register(ComplianceVerifier, ());
    let client = ComplianceVerifierClient::new(&env, &verifier);
    env.ledger()
        .with_mut(|li| li.timestamp = (f.period + 1) * 86_400);

    // Signed by someone who is not the admin — the host must reject the auth.
    env.mock_auths(&[MockAuth {
        address: &stranger,
        invoke: &MockAuthInvoke {
            contract: &verifier,
            fn_name: "verify",
            args: (treasury.clone(), proof(&env), public(&env)).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.verify(&treasury, &proof(&env), &public(&env));
}

// --- proof integrity and input shape ------------------------------------------------

/// Corrupting a coordinate moves the point off the curve, which the host refuses while
/// decoding — before the pairing check ever runs. Still fail-closed, just one layer down,
/// so this asserts the trap rather than a contract error code.
#[test]
#[should_panic]
fn rejects_a_proof_whose_points_are_off_curve() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, treasury, client, _f) = honest_setup(&env);

    let mut arr = [0u8; 256];
    arr.copy_from_slice(PROOF);
    arr[63] ^= 0x01; // corrupt A.y

    client.verify(&treasury, &Bytes::from_slice(&env, &arr), &public(&env));
}

/// The pairing check itself. Swapping A and C keeps both operands as valid curve points,
/// so decoding succeeds and the proof is rejected on its merits — the path that produces
/// `InvalidProof`.
#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn rejects_a_well_formed_proof_that_does_not_verify() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, treasury, client, _f) = honest_setup(&env);

    let mut arr = [0u8; 256];
    arr.copy_from_slice(PROOF);
    arr[0..64].copy_from_slice(&PROOF[192..256]); // A <- C
    arr[192..256].copy_from_slice(&PROOF[0..64]); // C <- A

    client.verify(&treasury, &Bytes::from_slice(&env, &arr), &public(&env));
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn rejects_short_proof_bytes() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, treasury, client, _f) = honest_setup(&env);

    let short = Bytes::from_slice(&env, &PROOF[..255]);
    client.verify(&treasury, &short, &public(&env));
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn rejects_short_public_bytes() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, treasury, client, _f) = honest_setup(&env);

    let short = Bytes::from_slice(&env, &PUBLIC[..415]);
    client.verify(&treasury, &proof(&env), &short);
}

// A field element has many byte encodings: `Bn254Fr::from_bytes` reduces modulo `r`, so
// `x` and `x + r` are the same element to the pairing check but different byte strings
// to anything reading the raw bytes — the period number here. Only canonical (< r)
// encodings are accepted, across all 13 signals.

/// Big-endian 256-bit add of the BN254 scalar order: a different byte string for the
/// same field element.
fn plus_modulus(v: &[u8]) -> [u8; 32] {
    const R: [u8; 32] = [
        0x30, 0x64, 0x4E, 0x72, 0xE1, 0x31, 0xA0, 0x29, 0xB8, 0x50, 0x45, 0xB6, 0x81, 0x81, 0x58,
        0x5D, 0x28, 0x33, 0xE8, 0x48, 0x79, 0xB9, 0x70, 0x91, 0x43, 0xE1, 0xF5, 0x93, 0xF0, 0x00,
        0x00, 0x01,
    ];
    let mut out = [0u8; 32];
    let mut carry = 0u16;
    let mut i = 32;
    while i > 0 {
        i -= 1;
        let s = v[i] as u16 + R[i] as u16 + carry;
        out[i] = (s & 0xff) as u8;
        carry = s >> 8;
    }
    out
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn rejects_a_non_canonical_signal() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, treasury, client, _f) = honest_setup(&env);

    let mut bytes = [0u8; PUBLIC_LEN];
    bytes.copy_from_slice(PUBLIC);
    let shifted = plus_modulus(&PUBLIC[96..128]); // periodId re-encoded as periodId + r
    bytes[96..128].copy_from_slice(&shifted);

    client.verify(&treasury, &proof(&env), &Bytes::from_slice(&env, &bytes));
}
