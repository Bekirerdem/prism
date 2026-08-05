#![cfg(test)]
use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Bytes, BytesN, Env};

// Binary fixtures emitted by packages/prover (one encoder, shared with the live call).
const PROOF: &[u8] = include_bytes!("../fixtures/proof.bin");
const PUBLIC: &[u8] = include_bytes!("../fixtures/public.bin");

// public_bytes layout (12 field elements x 32 bytes):
//   [dailyLimit(0..32), perTaskLimit(32..64), whitelistRoot(64..96), periodId(96..128), commitments(128..384)]
fn policy_from_fixture(env: &Env) -> (BytesN<32>, BytesN<32>, BytesN<32>) {
    let public = Bytes::from_slice(env, PUBLIC);
    let daily: BytesN<32> = public.slice(0..32).try_into().unwrap();
    let per_task: BytesN<32> = public.slice(32..64).try_into().unwrap();
    let root: BytesN<32> = public.slice(64..96).try_into().unwrap();
    (daily, per_task, root)
}

#[test]
fn valid_proof_attests() {
    let env = Env::default();
    let (daily, per_task, root) = policy_from_fixture(&env);
    let admin = Address::generate(&env);
    let id = env.register(ComplianceVerifier, (admin, daily, per_task, root));
    let client = ComplianceVerifierClient::new(&env, &id);

    let proof = Bytes::from_slice(&env, PROOF);
    let public = Bytes::from_slice(&env, PUBLIC);

    // Must not trap: a proof whose public policy matches the anchored policy passes
    // the on-chain pairing check and emits the attestation.
    client.verify(&proof, &public);
}

#[test]
#[should_panic]
fn tampered_proof_traps() {
    let env = Env::default();
    let (daily, per_task, root) = policy_from_fixture(&env);
    let admin = Address::generate(&env);
    let id = env.register(ComplianceVerifier, (admin, daily, per_task, root));
    let client = ComplianceVerifierClient::new(&env, &id);

    let mut arr = [0u8; 256];
    arr.copy_from_slice(PROOF);
    arr[63] ^= 0x01; // corrupt A.y -> off-curve / wrong point -> verification fails

    let proof = Bytes::from_slice(&env, &arr);
    let public = Bytes::from_slice(&env, PUBLIC);
    client.verify(&proof, &public); // expected to trap
}

// Critical #1: the proof's public policy must be checked against the policy the
// contract was anchored to. A valid proof carrying a DIFFERENT whitelist root than
// the one the owner deployed must be rejected — otherwise the attestation is vacuous.
#[test]
#[should_panic(expected = "policy")]
fn rejects_mismatched_policy() {
    let env = Env::default();
    let (daily, per_task, _root) = policy_from_fixture(&env);
    let wrong_root: BytesN<32> = BytesN::from_array(&env, &[0xABu8; 32]);
    let admin = Address::generate(&env);
    let id = env.register(ComplianceVerifier, (admin, daily, per_task, wrong_root));
    let client = ComplianceVerifierClient::new(&env, &id);

    let proof = Bytes::from_slice(&env, PROOF);
    let public = Bytes::from_slice(&env, PUBLIC);
    client.verify(&proof, &public); // proof is valid, but its root != anchored root -> trap
}

// Critical #2: the same proof cannot be attested twice (replay). A second verify
// of an already-attested period must trap.
#[test]
#[should_panic(expected = "already attested")]
fn rejects_replayed_proof() {
    let env = Env::default();
    let (daily, per_task, root) = policy_from_fixture(&env);
    let admin = Address::generate(&env);
    let id = env.register(ComplianceVerifier, (admin, daily, per_task, root));
    let client = ComplianceVerifierClient::new(&env, &id);

    let proof = Bytes::from_slice(&env, PROOF);
    let public = Bytes::from_slice(&env, PUBLIC);

    client.verify(&proof, &public); // 1st: attests
    client.verify(&proof, &public); // 2nd: same periodId -> trap
}

// Hardening v2: the anchored limits must fit the circuit's comparator bit-widths
// (perTaskLimit: LessEqThan(64), dailyLimit: LessEqThan(68)). A wider anchor would
// make the comparators misbehave, so the constructor rejects it at deploy time.
#[test]
#[should_panic(expected = "bit-width")]
fn rejects_daily_limit_wider_than_68_bits() {
    let env = Env::default();
    let (_daily, per_task, root) = policy_from_fixture(&env);
    let mut arr = [0u8; 32];
    arr[23] = 0x10; // exactly 2^68 -> first value out of range
    let wide_daily: BytesN<32> = BytesN::from_array(&env, &arr);
    let admin = Address::generate(&env);
    let _ = env.register(ComplianceVerifier, (admin, wide_daily, per_task, root));
}

#[test]
#[should_panic(expected = "bit-width")]
fn rejects_per_task_limit_wider_than_64_bits() {
    let env = Env::default();
    let (daily, _per_task, root) = policy_from_fixture(&env);
    let mut arr = [0u8; 32];
    arr[23] = 0x01; // exactly 2^64 -> first value out of range for the 64-bit comparator
    let wide_per_task: BytesN<32> = BytesN::from_array(&env, &arr);
    let admin = Address::generate(&env);
    let _ = env.register(ComplianceVerifier, (admin, daily, wide_per_task, root));
}

#[test]
fn accepts_limits_at_bit_width_boundary() {
    let env = Env::default();
    let (_daily, _per_task, root) = policy_from_fixture(&env);
    // daily = 2^68 - 1 and per_task = 2^64 - 1: the widest in-range anchors.
    let mut d = [0u8; 32];
    d[23] = 0x0F;
    let mut p = [0u8; 32];
    for i in 24..32 {
        d[i] = 0xFF;
        p[i] = 0xFF;
    }
    let daily: BytesN<32> = BytesN::from_array(&env, &d);
    let per_task: BytesN<32> = BytesN::from_array(&env, &p);
    let admin = Address::generate(&env);
    let id = env.register(ComplianceVerifier, (admin, daily.clone(), per_task, root));
    let client = ComplianceVerifierClient::new(&env, &id);
    assert_eq!(client.get_policy().daily_limit, daily);
}

// D2: malformed input lengths fail closed with a typed error (Error(Contract, #1)/#2)
// instead of an opaque slice/try_into panic. proof = 256 bytes, public = 384 bytes.

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn rejects_short_proof_bytes() {
    let env = Env::default();
    let (daily, per_task, root) = policy_from_fixture(&env);
    let admin = Address::generate(&env);
    let id = env.register(ComplianceVerifier, (admin, daily, per_task, root));
    let client = ComplianceVerifierClient::new(&env, &id);

    let short_proof = Bytes::from_slice(&env, &PROOF[..255]); // 255 != 256
    let public = Bytes::from_slice(&env, PUBLIC);
    client.verify(&short_proof, &public); // -> InvalidProofLength
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn rejects_short_public_bytes() {
    let env = Env::default();
    let (daily, per_task, root) = policy_from_fixture(&env);
    let admin = Address::generate(&env);
    let id = env.register(ComplianceVerifier, (admin, daily, per_task, root));
    let client = ComplianceVerifierClient::new(&env, &id);

    let proof = Bytes::from_slice(&env, PROOF); // valid 256
    let short_public = Bytes::from_slice(&env, &PUBLIC[..383]); // 383 != 384
    client.verify(&proof, &short_public); // -> InvalidPublicInputLength
}

// Hardening v3 (2026-08-05 audit, M2): a field element has many byte encodings.
// `Bn254Fr::from_bytes` reduces modulo the scalar order `r`, so `periodId` and
// `periodId + r` are the SAME element to the pairing check but DIFFERENT keys to
// the replay guard, which keys on the raw 32 bytes. An unmodified, already-spent
// proof could therefore be resubmitted ~5 times per period (r is ~0.189 * 2^256).
// Only canonical encodings (< r) are accepted now, across all 12 signals.

/// Big-endian 256-bit add of the BN254 scalar order: a different byte string for
/// the same field element.
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
fn rejects_non_canonical_period_id() {
    let env = Env::default();
    let (daily, per_task, root) = policy_from_fixture(&env);
    let admin = Address::generate(&env);
    let id = env.register(ComplianceVerifier, (admin, daily, per_task, root));
    let client = ComplianceVerifierClient::new(&env, &id);

    let proof = Bytes::from_slice(&env, PROOF);
    client.verify(&proof, &Bytes::from_slice(&env, PUBLIC)); // 1st: attests, period consumed

    // Same proof, periodId re-encoded as periodId + r. The pairing check cannot
    // tell the difference; the replay guard used to.
    let mut bytes = [0u8; 384];
    bytes.copy_from_slice(PUBLIC);
    let shifted = plus_modulus(&PUBLIC[96..128]);
    bytes[96..128].copy_from_slice(&shifted);
    client.verify(&proof, &Bytes::from_slice(&env, &bytes)); // -> NonCanonicalSignal
}
