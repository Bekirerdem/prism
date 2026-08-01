# Confidential compliance (ZK)

A business can't publish who it pays and how much on a public ledger — but its owner,
auditor, or counterparty still needs to know the spending stayed inside the rules.
Eunomia's answer: **prove compliance, reveal nothing.**

## What is proven

A Groth16 (BN254) proof, verified **on-chain** by the Compliance Verifier contract,
attests that a batch of agent payments obeyed policy:

- every payment ≤ the per-payment cap,
- the batch total ≤ the daily cap,
- every payee ∈ a committed approved list —

**without revealing a single amount or payee.** Payments are committed as
`Poseidon(amount, payee, salt)`; only the commitments and the proof go on-chain.
Public signals: `[dailyLimit, perTaskLimit, whitelistRoot, periodId, commitments[8]]`.

## Why the verifier is "hardened", not just a math check

- **Policy binding.** The verifier anchors the owner's policy at deploy time and requires
  the proof's public `dailyLimit / perTaskLimit / whitelistRoot` to byte-match the anchor.
  A valid proof for some *self-chosen* policy cannot attest.
- **Replay guard.** Each `periodId` is consumed once (persistent guard) — a compliant
  proof can't be replayed to mask a later non-compliant period. The replay rejection is
  live on testnet as a real failed transaction.
- **Fail-closed input validation.** Malformed proof or signal lengths trap with typed
  errors instead of undefined behavior.

## Honest scope

- The ZK layer attests **after the fact** today: `pay()` does not yet require a proof.
  Wiring confidential compliance into the payment flow (confidential-by-default) is
  roadmap work — see [Roadmap](/roadmap).
- If settlement moves real tokens to revealed payees, those transfers stay visible at the
  token-contract layer; transfer-level privacy is the shielded-pool track.
- The Groth16 setup is a single-party dev setup; a multi-party ceremony is a mainnet
  prerequisite.

## Composability: Eunomia as a policy for confidential tokens

Eunomia's payee gate is also packaged as an OpenZeppelin Confidential Token `Policy`
(`is_authorized(account, token) → bool`). Wired as a confidential token's compliance
policy, every *private-amount* transfer is still bounded to Eunomia-approved payees:
**the confidential token hides the amount; Eunomia bounds the payee.**

## Toolchain

Circom + snarkjs (Groth16/BN254) · Poseidon commitments · public Hermez powers-of-tau ·
on-chain verifier generated with `soroban-verifier-gen`, verified via Soroban's native
`bn254_multi_pairing_check` host functions.
