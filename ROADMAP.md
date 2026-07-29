# PRISM Roadmap

PRISM is moving from a proven testnet product to **mainnet agent-payments infrastructure on Stellar**. Milestones are sequenced, not dated — each one unlocks the next, and each is verifiable on-chain or in the repo.

## M1 — Traction on testnet *(current)*

- [x] Bounded treasury live on testnet — payee whitelist + per-task & daily limits enforced on-chain
- [x] Per-user product: connect a wallet → deploy your own treasury → fund → whitelist → spend
- [x] ZK compliance layer — Circom/Groth16 proofs, hardened on-chain BN254 verifier (policy binding + replay guard)
- [x] Analytics & monitoring + in-app feedback + on-chain activity logging (proof of usage)
- [x] 10+ real user wallets with on-chain interactions (risein Journey-to-Mastery Level 4) — 14 external testers, 12 with on-chain proof, 13 tester-deployed treasuries
- [x] Published user-feedback summary — [README → Testers & traction](README.md#testers--traction)

## M2 — Agent infrastructure *(shipped 2026-07-07)*

Closing the gap between "a human signs every payment" and "an agent spends autonomously, safely":

- [x] **Session-key agent signing** — time-bound, spend-capped agent credentials per user treasury (`agent ≠ admin`), instant revocation; the browser session key signs payments with zero wallet popups
- [x] **Contract lifecycle** — pause/freeze switch, agent-key rotation, admin withdraw, limit updates (the contract stays deliberately non-upgradeable; the exit is pause + withdraw)
- [x] **On-chain treasury registry** — discovery & recovery by owner wallet (no client-side-only state)
- [x] **Rolling daily-limit window** — closed the fixed-UTC-day 2× boundary spend (hourly buckets)

## M3 — Mainnet

- [ ] Circle **USDC** integration — real dollars replace test-minted assets
- [ ] Security hardening pass + external review / audit path
- [ ] Multi-party **trusted-setup ceremony** for the ZK circuit (replacing the single-party dev setup)
- [ ] Mainnet deployment with conservative default policies

## M4 — Ecosystem integrations

- [ ] Production **ERC-8004 reputation** ([trionlabs/stellar-8004](https://github.com/trionlabs/stellar-8004)) — earned reputation replaces the testnet stand-in oracle
- [ ] **OpenClaw / ClawHub skill** — agents create and manage their PRISM treasury conversationally
- [ ] **x402 productization** — bounded pay-per-use spending for agent-facing APIs
- [ ] ZK compliance wired into the payment flow (confidential-by-default option), composing with OpenZeppelin Confidential Tokens via `ComplianceHooks`

## M5 — Growth & sustainability

- [ ] 50+ active user wallets (risein Level 5-7 targets)
- [ ] Revenue model validated with real users (candidates: fee on treasury operations, premium policy features) — decided by usage data, not assumption
- [ ] Ecosystem partnerships formalized (Stellar Türkiye, Trion Labs, agent-platform integrations)

---

**Where we are:** M2 is shipped — treasury v3 (agent sessions + lifecycle + rolling window, [design spec](docs/superpowers/specs/2026-07-07-prism-m2-design.md)) and the treasury registry are live on testnet, wired into the app. M1's remaining boxes (10+ user wallets, published feedback summary) are distribution work in progress. M3 (mainnet path) is next. Progress is tracked in the commit history and [`DEPLOYMENT.md`](DEPLOYMENT.md).
