# Security Model

Eunomia is **testnet-only** today — do not use it with real funds. The path to mainnet is
security-gated; see [Roadmap](/roadmap) for what must land first.

## The model

- **Non-custodial.** Funds live in the owner's own contract. Eunomia code cannot move value
  outside the on-chain rules; violations are rejected by the contract, on-chain.
- **No front-runnable initialization.** Rules are set atomically in the constructor —
  there is no separate `initialize` to race.
- **Checks-effects-interactions.** Accounting is written before the token transfer; a
  failed transfer reverts the whole call. Soroban additionally forbids host-level
  reentrancy.
- **Overflow-checked arithmetic.** Spend accounting panics (reverts) rather than wrapping.
- **Sponsored fees are not custody.** A passkey user holds no XLM, so someone else pays the
  transaction fee. That account cannot redirect or alter the payment: authorisation is a
  signature from your own passkey, bound to your smart wallet's address, and the contract
  checks it independently of whoever submitted the transaction.
- **Deliberately non-upgradeable.** No upgrade entrypoint — "the rules are enforced"
  never degrades into "trust the admin". Exit = pause → withdraw → fresh treasury.
- **Hardened ZK verifier.** Proofs are bound to the owner's anchored policy and each
  period can attest only once (replay guard) — both covered by tests and a live
  replay-rejected transaction on testnet.

## Audit history

Two agent-assisted internal reviews (2026-06-03 pre-ZK, and a 2026-07-07 fresh-eyes pass
after M2). **No critical findings; every actionable finding is closed** — highlights:

| Finding | Closure |
| --- | --- |
| Daily cap reset on UTC calendar day (2× boundary spend) | Rolling 24h window, hourly buckets |
| CEI ordering in `pay()` | Effects recorded before transfer |
| No owner exit if agent key lost | `admin_withdraw` + `set_paused` + `set_agent` |
| Compromised agent could lock funds in escrows | `admin_cancel_escrow` (owner-signed, works while paused) |
| Storage TTL — idle entries could archive | Every mutation auto-extends instance TTL (v3.2) |
| Wallet selection reset to Freighter on reload | Selected wallet persisted |

The only open item is CSP/security headers on the static site (testnet demo scope).

## Known limitations (honest scope)

- **Session secrets live in the browser** — acceptable on testnet precisely because the
  credential is bounded (cap + expiry + instant revoke); mainnet needs hardened key
  storage and fee sponsorship.
- **The ZK layer attests after the fact** — `pay()` does not yet require a proof (see
  [Confidential compliance](/zk)).
- **The reputation oracle is a stand-in** — scores are admin-set on testnet; production
  targets the stellar-8004 registries.

## Reporting a vulnerability

Preferred: GitHub **private vulnerability reporting** on the repository
(Security → Report a vulnerability), or email **l3ekirerdem@gmail.com**. Reports are
acknowledged as fast as possible; fixes are prioritized ahead of feature work.
