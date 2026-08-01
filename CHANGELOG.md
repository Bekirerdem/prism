# Changelog

Notable changes to PRISM, grouped by release wave. Full detail lives in the
[conventional-commit history](https://github.com/eunomia-finance/eunomia/commits/main);
deployed addresses and on-chain proofs in [`DEPLOYMENT.md`](DEPLOYMENT.md).

## [0.4.1] — 2026-07-07 · Fresh-eyes review wave (treasury v3.1 + UX hardening)

A four-track independent review (contracts, web libs, UX flow, cross-consistency)
before the user-acquisition push; every confirmed finding fixed the same day.

- **Fixed (contract v3.1)** — `admin_cancel_escrow`: the owner can unilaterally unwind an
  open escrow (a compromised agent could previously tie up the whole treasury in escrows
  only it could refund) · escrow deadlines validated (`#12 InvalidDeadline`) · escrow
  entries get TTL extended past their deadline (archived-entry / stranded-`Locked` risk) ·
  whitelist + reputation-gate mutations now emit events (`payee_add`/`payee_rm`/`rep_gate`)
  · 48 tests
- **Fixed (web)** — selected wallet module persisted across reloads (a reconnected
  xBull/Lobstr/WalletConnect session no longer signs through Freighter) · `agentPay` stops
  labeling permanent failures as retryable (+ `TRY_AGAIN_LATER` now retried) · session
  start signs first, friendbot-funds after (declines no longer burn rate-limited friendbot
  calls) · corrupted session keys get a guided message · registry recovery StrKey-filters
  ids · per-action busy states (buttons show progress; no more frozen-app feel) · stale
  wallet state fully reset on account switch · persistent "back up your ID" hint (was a
  transient status message the next action erased) · XLM/USDC expectation set before
  deploy + two-approval flow explained upfront · `PayResult`/`PrismState`/`errText`
  single-sourced · `prism.ts` finally under test (92 web tests)
- **Docs** — circuit test count 6/6 · dated milestone counts in DEPLOYMENT · TRY-IT
  (EN/TR) covers agent sessions + owner controls · per-package READMEs
  (treasury-client/registry-client/prover) · prover on stellar-sdk v14 · SECURITY gains
  the review-wave findings table

## [0.4.0] — 2026-07-07 · M2 agent infrastructure (treasury v3 + registry)

The gap between "a human signs every payment" and "an agent spends autonomously,
safely" — closed ([design spec](docs/superpowers/specs/2026-07-07-prism-m2-design.md)).

- **Added (contract v3)** — agent **sessions**: time-bound, spend-capped, instantly
  revocable credentials that are the *only* spender while active (single-spender rule) ·
  lifecycle: `set_paused` (exit paths never lock), `admin_withdraw` (free balance,
  window-exempt), `set_limits` (validated, immediate), `set_agent` rotation ·
  **rolling 24h window** replaces the fixed UTC day (hourly buckets; audit finding C2
  closed with an on-chain-provable boundary test) · constructor limit validation (C5) ·
  new errors `#9 Paused`, `#10 ExceedsSessionLimit`, `#11 InvalidLimits` · 45 tests
- **Added (registry)** — permissionless `treasury_registry` contract (owner → treasuries)
  + best-effort registration on deploy + cross-device recovery in the Workspace
- **Added (app)** — Controls (pause/resume, withdraw, limit updates) · Agent session
  section with zero-popup **Run autonomous task** (browser session key signs; wallet
  popups only to start/revoke) · legacy-treasury detection (pre-M2 treasuries keep
  working, new sections hide) · friendly messages for #9–#11
- **Changed** — `day_spent()` now reports the rolling 24h window (UI label "Last 24h");
  the `DaySpent` calendar-day key is gone from v3; per-user deploys instantiate the v3
  wasm — earlier treasuries stay on their original immutable code
- **Decided** — the contract remains **non-upgradeable by design**: the exit is
  pause + withdraw + redeploy, not "trust the admin"

## [0.3.2] — 2026-07-06 · Hardening wave

- **Fixed (contract)** — `pay()` can no longer spend escrow-locked funds (free-balance
  invariant, `#6`); +10 hardening tests (auth-negatives, escrow lifecycle edges)
- **Fixed (web)** — head-based event paging (newest events never dropped; ~1 RPC per
  refresh) · multi-treasury localStorage schema (second deploy no longer overwrites the
  first id) · per-treasury monitor counters · friendly contract-error messages (#1..#8)
  from a single map · generated client regenerated from the v2.1 wasm (escrow +
  reputation callable; single-source `npm run generate` + CI byte-sync guard)
- **Docs** — stale claims synced (feedback → Google Form, test counts, DEMO wording);
  orphan in-app feedback modal removed

## [0.3.1] — 2026-07-02 · Onboarding & UX hardening

First-real-users wave: everything a cold wallet hits in its first five minutes.

- **Added** — testnet funding gate (friendbot one-click for empty wallets) · treasury-ID
  copy + save hint + contract-id validation · sample-vendor payee fill + spend prefill ·
  global wallet chip in a redesigned nav (connect / copy / disconnect, shared across
  landing and app) · hash routing (refresh keeps the current view) · Turkish quickstart
  ([`docs/TRY-IT-TR.md`](docs/TRY-IT-TR.md)) · [`ROADMAP.md`](ROADMAP.md) · [`SECURITY.md`](SECURITY.md)
- **Fixed** — activity feed now watches the connected user's own treasury and pages
  `getEvents` to the ledger head (day-wide windows span multiple RPC pages) · wallet view
  hydrates the shared connection · deploy/fund/whitelist/pay errors surface in human
  language · mobile nav no longer hides all links · fixed-width spend bars
- **Docs** — README refocused on the product (Level 1-3 requirement-proof sections removed,
  per-user product screenshots added) · honest testnet-USDC/XLM scope

## [0.3.0] — 2026-07-01 · Per-user product (Level 4)

From spectator demo to a product you can use with your own wallet.

- **Added** — connect any Stellar wallet → deploy **your own** bounded treasury
  (non-custodial, native XLM) → fund → whitelist payees → spend; policy violations rejected
  on-chain · analytics & monitoring (payments, totals, violations, errors from on-chain
  events) · in-app feedback (Supabase, insert-only RLS) · on-chain activity logging
  (proof-of-usage backbone)

## [0.2.0] — 2026-06-18 → 06-23 · Confidential ZK + open-economy trust layer

Built during Stellar Hacks: Real-World ZK; submitted to DoraHacks.

- **Added (ZK)** — Circom/BN254 compliance circuit (per-task range + daily-sum bounds +
  Poseidon commitments + Merkle whitelist membership) · Groth16 trusted setup (Hermez ptau) ·
  **on-chain BN254 verifier** with anchored-policy binding + replay guard, live on testnet
  with a replay-rejected proof · CSPRNG commitment salts
- **Added (trust)** — reputation-gated payees (whitelist OR earned ERC-8004-style trust) ·
  outcome-bound escrow (lock → release / refund) · bounded x402 buyer (policy gate before
  settle, live on-chain settle) · Treasury v2 on testnet
- **Added (app)** — multi-wallet support via StellarWalletsKit · real-time on-chain event
  feed · Vitest suites + 3-job CI (contracts / web / packages)

## [0.1.0] — 2026-06-03 · Bounded agent treasury (IBW 2026)

🏆 2nd place, AGENTIC category — Stellar Build On Hackathon (IBW 2026, Istanbul).

- **Added** — Soroban bounded treasury: payee whitelist · per-task limit · daily limit,
  enforced on-chain with per-task accounting (checks-effects-interactions, atomic
  constructor init) · autonomous-agent demo dashboard (prompt-injection rejected on-chain) ·
  muxed-account funding rail (zero-cost sub-address attribution) · spectral landing + pitch
  deck · build-time guard refusing the demo key off-testnet

[0.3.1]: https://github.com/eunomia-finance/eunomia/commits/main
[0.3.0]: https://github.com/eunomia-finance/eunomia/commits/main
[0.2.0]: https://github.com/eunomia-finance/eunomia/commits/main
[0.1.0]: https://github.com/eunomia-finance/eunomia/commits/main
