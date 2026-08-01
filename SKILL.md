---
name: prism-bounded-treasury
description: >
  Use when giving an AI agent a safe, non-custodial spending account on Stellar: deploying a
  bounded treasury (per-payment + rolling daily limits, payee whitelist), issuing time-bound
  spend-capped agent session keys, escrowing payments to deadlines, gating payees by on-chain
  reputation, wiring x402 payments through a contract-enforced policy, or proving that a batch of
  agent payments complied with policy via a Groth16/BN254 zero-knowledge proof verified on-chain.
  Also use when users mention agent spending limits, bounded agents, agent treasuries, autonomous
  payments with guardrails, confidential compliance, or "the wallet an AI agent can't drain" —
  even if they don't mention PRISM by name.
license: MIT
compatibility: Designed for Claude Code and compatible AI coding assistants. Building the contracts requires Rust + stellar-cli; the web client and prover run on Node.
metadata:
  author: Bekir Erdem & Seyit Ali Değirmen
  version: "0.4"
---

# PRISM — Bounded Agent Treasury on Stellar

PRISM is a non-custodial Soroban treasury that lets an AI agent spend real money while the
**contract** — not the model's good intentions — enforces the policy. Every violation (unknown
payee, over-limit payment, expired session) is rejected **on-chain**. A ZK layer proves a batch of
payments complied with policy without revealing amounts or payees.

- Repo: https://github.com/eunomia-finance/eunomia · Live app (testnet): https://eunomia.finance
- Deep docs in-repo: `README.md` (product tour), `DEPLOYMENT.md` (all deployed contracts),
  `SECURITY.md` (audit findings + known limitations), `ROADMAP.md`, `docs/TRY-IT.md` (5-minute walkthrough).

## When to reach for PRISM

1. An agent must pay for APIs/services autonomously, but its blast radius must be capped by contract.
2. You need auditable, task-attributed agent spending (`task_id` accounting, on-chain events).
3. You need to prove policy compliance to a third party **without disclosing** payment details (ZK).
4. You want x402-style pay-per-call where every payment passes a policy gate before settling.

## Live contracts (Stellar testnet)

| Contract | Address |
|---|---|
| Treasury wasm v3.1 (deploy your own from this hash) | `7e103d8c177f3b46d4f7ccee695e7c9a92f5d3e5e55b96324173f923db9f9ae7` |
| Treasury Registry (cross-device discovery) | `CBEPVXK6BN2FZ3IYHV5KQUGROFHNBWBYHKHRZ5U3O7UWGIOPFOFE4ZE7` |
| Compliance Verifier (ZK, hardened, policy-anchored) | `CCOLX7NEBDJRRVTPFVSK3UJLHMG3HO4UVYJW3NFBOTUG7Q7GOP63DBRH` |
| Reputation Oracle (stellar-8004 stand-in) | `CCJFIEYFNPRTJVCOGOSESYC5Z6FHHHYAH36V7QTZEDPKESY6O5TPINKY` |
| Prism Policy (OpenZeppelin ComplianceHooks adapter) | `CBWMYGL7E663UON6ER5KQX2JZZA4UDZZD4RIFEHGXXF2HMMBRAN7BLQF` |

The full (historical + demo) address table lives in `DEPLOYMENT.md`.

## Quickstart

**Fastest path:** open https://eunomia.finance → connect a wallet (Freighter, xBull,
Albedo, LOBSTR, Rabet, Hana, or WalletConnect on mobile) → *Create your own treasury* → fund →
whitelist a payee → pay. Over-limit payments are rejected by the contract, visibly.

**CLI path — deploy your own treasury from the installed wasm (no build needed):**

```bash
stellar contract deploy \
  --wasm-hash 7e103d8c177f3b46d4f7ccee695e7c9a92f5d3e5e55b96324173f923db9f9ae7 \
  --source-account YOU --network testnet \
  -- --admin G_YOUR_ADDRESS --agent G_AGENT_ADDRESS \
     --token C_SEP41_OR_SAC_TOKEN \
     --daily_limit 500000000 --per_task_limit 100000000
```

`admin` owns the policy; `agent` is the only address allowed to spend (they may be the same
wallet — the live app's non-custodial default). `token` is any SEP-41/SAC contract (the live app
uses native XLM's SAC on testnet; amounts are in the token's smallest unit, 7 decimals for XLM/USDC).

**Build from source (optional):** `cargo test` then `stellar contract build` in
`contracts/treasury/` — target is `wasm32v1-none`.

## Core contract API (treasury v3.1, verified signatures)

```rust
__constructor(admin, agent, token, daily_limit, per_task_limit)  // per_task <= daily, both > 0
// Spending (agent — or active session agent — auth):
pay(task_id: u64, to: Address, amount: i128)          // whitelist OR reputation gate + limits
create_escrow(task_id, payee, amount, deadline) -> id // locks funds from free balance
release_escrow(id) / refund_escrow(id)                // deliver vs deadline-passed refund
// Policy management (admin auth):
add_payee(payee) / remove_payee(payee)
set_reputation_policy(registry, min_reputation)       // payee passes if whitelisted OR rep >= min
set_session(agent, valid_until, limit) / revoke_session()  // time-bound, spend-capped credential
set_limits(daily_limit, per_task_limit) / set_agent(agent)
set_paused(true|false) / admin_withdraw(to, amount) / admin_cancel_escrow(id)
// Views: get_config, is_payee, task_spent(task_id), day_spent, balance, locked, get_escrow(id), get_session
```

**Error codes:** 1 InvalidAmount · 2 PayeeNotWhitelisted · 3 ExceedsTaskLimit ·
4 ExceedsDailyLimit · 5 BelowReputationThreshold · 6 InsufficientFreeBalance · 7 EscrowNotFound ·
8 DeadlineNotReached · 9 Paused · 10 ExceedsSessionLimit · 11 InvalidLimits · 12 InvalidDeadline.

**Registry:** `register(owner, treasury)` / `treasuries_of(owner) -> Vec<Address>` — the app uses
it so a user's treasuries survive browser/device changes.

## Agent sessions (account-abstraction pattern)

`set_session(agent, valid_until, limit)` issues a temporary spender credential. While active
(`now < valid_until`) the session agent **replaces** the root agent as the only spender; when it
expires or `revoke_session()` fires (works even while paused — incident response), spending falls
back to `Config.agent`. The web app can generate a browser-held session key that signs payments
without wallet popups, capped by the session limit.

## x402 integration (`packages/x402`)

`gateX402(paymentRequirements, treasuryPolicy)` checks an x402 payment request against the
treasury policy off-chain; `boundedPay(...)` settles allowed requests through the real on-chain
`pay(...)` via `makeTreasurySettle` (stellar-cli wrapper — the agent key stays in the OS keychain,
never in code). Policy-violating requests are refused before any funds move.

## Confidential compliance (ZK)

Circuit: `circuits/compliance.circom` (Groth16 over **BN254**, Poseidon commitments — matches
Stellar's Protocol 25 "X-Ray" `bn254_multi_pairing_check` host function). One proof attests, for a
batch of hidden payments: Σamount ≤ daily limit, every amount ≤ per-task limit, every payee ∈
whitelist Merkle root — without revealing amounts or payees. The on-chain verifier is
**policy-anchored** (constructor pins daily/per-task/whitelist-root; `verify()` byte-compares
public inputs) and **replay-guarded** (one attestation per `periodId`). Prover toolchain:
`circuits/scripts/prove.ts` + `packages/prover` (salt is CSPRNG — never sequential).

## Gotchas (non-obvious facts an agent will get wrong)

- **The daily limit is a rolling 24h window** (v3.1+), not a UTC calendar day.
- **Escrowed funds are locked:** `pay()` spends only *free* balance (`balance - locked`); a
  compromised agent cannot drain the treasury into escrows either — `admin_cancel_escrow` exists.
- **A session replaces the root agent** while active; it does not add a second spender.
- **SAC recipients that are classic G-accounts need a trustline** for the token first, or the
  transfer fails with `Error(Contract, #13)`. Contract (C-address) recipients don't.
- **Per-task limit must be ≤ daily limit** — the constructor and `set_limits` both panic/err otherwise.
- **Build target is `wasm32v1-none`** (not `wasm32-unknown-unknown`); mainnet contract size cap is 128KB.
- **Soroban `getEvents` scans ~10k ledgers per page** — paginate with the cursor to the head or a
  24h window will silently miss recent events (the app does this).
- **x402 facilitator note:** as of `@x402/*` v2.12 the OpenZeppelin Channels facilitator requires
  an `OZ_API_KEY` even on testnet. PRISM's bundled flow settles directly through the treasury and
  does not need the facilitator.
- **Old verifier `CA3A7AOG…WS5B` is deprecated** (pre-hardening constructor); use `CCOLX7NE…DBRH`.

## Project structure

```
contracts/   treasury (v3.1) · treasury_registry · compliance_verifier · reputation_oracle · policy (OZ hooks)
circuits/    compliance.circom + prove/verify scripts (Groth16/BN254, Poseidon)
packages/    x402 (gate + bounded settle) · prover (salt, submit)
web/         React app — wallet kit, per-user workspace, analytics, session keys
```

## Resources

- Product & proof links (live txs, demo video): `README.md`
- All deployed addresses & wasm hashes: `DEPLOYMENT.md`
- Security posture & disclosure: `SECURITY.md`
- Try-it walkthrough: `docs/TRY-IT.md` (EN) · `docs/TRY-IT-TR.md` (TR)
