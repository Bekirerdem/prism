# Roadmap

Eunomia is moving from a proven testnet product to **mainnet agent-payments infrastructure
on Stellar**. Milestones are sequenced, not dated — each unlocks the next, and each is
verifiable on-chain or in the repo.

## M1 — Traction on testnet *(current)* ✅

Bounded treasury + per-user product + ZK compliance layer live on testnet · analytics,
in-app feedback and on-chain activity logging (proof of usage) · 10+ real user wallets
with on-chain interactions · published feedback summary.

## M2 — Agent infrastructure *(shipped)* ✅

- **Leash sessions** — time-bound, spend-capped agent keys per treasury, zero-popup
  signing, instant revocation; the only spender while active.
- **Lifecycle** — pause/resume, admin withdraw, live limit updates, agent rotation
  (the contract stays deliberately non-upgradeable).
- **Treasury Registry** — on-chain discovery & recovery by owner wallet.
- **Rolling 24h window** — closed the fixed-UTC-day 2× boundary spend.

## M3 — Mainnet

Circle **USDC** integration · security hardening + external review path · multi-party
**trusted-setup ceremony** for the ZK circuit · mainnet deployment with conservative
default policies.

## M4 — Ecosystem integrations

Production **ERC-8004 reputation** (trionlabs/stellar-8004) · OpenClaw/ClawHub skill
(agents manage their treasury conversationally) · **x402** bounded pay-per-use for
agent-facing APIs · ZK compliance wired into the payment flow, composing with
OpenZeppelin Confidential Tokens.

## M5 — Growth & sustainability

50+ active user wallets · revenue model validated with real users (decided by usage
data, not assumption) · ecosystem partnerships formalized.

---

**Where we are:** M2 is shipped and live in the app; M3 (mainnet path) is next. Progress
is tracked in the [commit history](https://github.com/eunomia-finance/eunomia/commits/main) and
[`CHANGELOG.md`](https://github.com/eunomia-finance/eunomia/blob/main/CHANGELOG.md).
