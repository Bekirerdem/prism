# Prism — demo & pitch

## One-liner

> Prism is the wallet your AI agent can't drain. A business hands an autonomous agent real
> money to spend; the **contract** enforces the limits, every payment is auto-accounted, and
> Stellar settles in sub-cents.

## 30-second pitch

AI agents can reason and act — until they need to pay. No business gives an LLM agent a
wallet, because one jailbreak drains it and hundreds of micro-payments are impossible to
reconcile. Prism fixes both: the agent's spend is **bounded by a Soroban contract** (whitelist,
per-task and daily limits, rejected on-chain), every payment is **auto-accounted per task**,
and budgets are funded through **zero-cost muxed sub-addresses** — Stellar primitives nothing
else matches. It's live on testnet, settling payments in testnet USDC (a test-issued asset;
per-user treasuries run on native testnet XLM — Circle USDC is the mainnet path).

## 90-second live demo

1. **Landing → Launch live demo.** "This dashboard is reading live testnet state — 495 USDC
   sitting in the business's own non-custodial contract."
2. **▶ Run agent tasks.** "The agent pays three vendors autonomously — it signs its own
   transactions, no human, no wallet popup. Watch them settle." → 3 tx links, balance drops.
3. **⚠ Simulate prompt-injection.** "Now I jailbreak the agent: send everything to an
   attacker wallet." → 🔴 **Blocked on-chain — PayeeNotWhitelisted. Funds never moved.**
   "The model misbehaved. The contract didn't care."
4. **Auto-reconciled spend.** "Every payment is tagged to its task, read straight off-chain —
   reconcile a thousand agent payments with zero memos."
5. **Funding rail.** "Fund the Research agent's budget — one click pays its zero-cost muxed
   sub-address; the deposit is attributed on-chain with no memo. One account, infinite
   sub-budgets." → attributed deposit appears.
6. **Close:** "Bounded. Accounted. Funded. All Stellar-native. All live."

## Full product demo — app shell (screen-recording script)

Goal: prove Prism is a **usable product**, not a scripted demo — a first-time user connects a
wallet, deploys their **own** bounded treasury, the contract rejects a real over-spend, and an
agent then spends on a revocable **Leash** with no wallet popups. **Real screen recording**
(Freighter + live testnet, real tx hashes) with voiceover *or* captions — no static-screenshot
zoom/pan. Target ~3:10.

| Time | Screen | Say / caption |
|---|---|---|
| 0:00–0:12 | Landing hero | "The wallet your AI agent can't drain. Not a mockup — I'll deploy my own in three minutes, live." |
| 0:12–0:26 | **Open app** → Connect wallet → Freighter approve | "I connect my own Stellar wallet. This address becomes the treasury owner — nobody custodies my funds." |
| 0:26–0:50 | **Setup** wizard → limits (per-payment 10 / daily 50) → sign | "One signature deploys *my* bounded treasury on-chain. I set the rules; the contract keeps them." *(show the tx)* |
| 0:50–1:05 | **Overview** — balance, limit bar, next-step stepper | "This is my treasury. Balance, remaining daily allowance, and what to do next — read live from chain." |
| 1:05–1:18 | **Fund** it from the wallet | "I fund it with testnet XLM. The funds live in my contract, never with Prism." |
| 1:18–1:33 | **Payments** → add payee (sample vendor) | "I approve exactly one payee. Only this address can ever receive money." |
| 1:33–1:52 | **Payments** → pay the payee, in-policy → settles | "In-policy payment: inside the limit, to an approved payee. Settled on-chain in seconds." *(tx link, balance drops)* |
| **1:52–2:15** | **Payments** → pay over the limit **→ 🔴 blocked** | **The climax — hold on this.** "Now I overspend. The contract rejects it: `ExceedsTaskLimit`. The funds never moved. The model can misbehave — the contract doesn't care." *(open the failed tx in Stellar Expert)* |
| 2:15–2:40 | **Agent** → start a Leash (duration + cap) → run autonomous task | "I hand an agent a Leash: time-bound, spend-capped, revocable. It signs its own payments — no popups — and it still can't cross the policy." |
| 2:40–2:52 | **Agent** → revoke the Leash | "One click and the agent's authority is gone. Revocation is on-chain, not a promise." |
| 2:52–3:05 | **Activity** — full platform feed, BLOCKED rows | "Every action by every user, streamed live — including the drain attempts the contract turned down." |
| 3:05–3:15 | **Settings** → pause / limits, then landing CTA | "Pause the treasury or withdraw at any time. Deploy your own at prism-stellar.vercel.app." |

**Recording notes**

- **Start from a fresh treasury** — switcher → **＋ New treasury**. Older treasuries run legacy
  WASM where the Leash beat (Agent section) won't work.
- Pre-fund the wallet before recording so friendbot waits don't land on camera; keep Freighter
  on **Testnet**; let each tx confirm on camera — the real hash is the proof.
- 1080p, cursor visible, no browser notifications on screen.
- **Grab stills while you're in there** (submission needs them): Overview (connected), Payments
  with the blocked attempt, Activity, and one mobile screen at 390 px.
- Optional confidential-mode beat (ZK proof → attested) slots in before Activity if the cut
  runs short.

## Why Stellar (have this ready)

Sub-cent deterministic fees make agent micro-payments viable; **muxed accounts** are the
zero-cost attribution primitive for payment swarms; **`__check_auth`** makes a contract-bounded
agent first-class; native USDC + anchors reach the real world. The bounded-spend safety exists
elsewhere — the **cheap attribution + fiat-grade rail** is where Stellar wins.

## Judging map

| Criterion | Our evidence |
|---|---|
| Real-world impact | The #1 blocker to agentic commerce (safe + accountable agent spend) — SDF's own Agents hackathon names "payments" as the hard stop |
| Technical | Real Soroban contract (policy + `__check_auth` semantics, per-task accounting, events), deployed + verified on testnet; on-chain rejection demoed live |
| UX | One-click autonomous agent, visceral on-chain rejection, live reconciliation, cinematic landing |
| Ecosystem fit | Muxed accounts, SAC/USDC, path-ready, ERC-8004 (trionlabs) trust layer — composes with the ecosystem |
| Presentation | The "contract says no" moment + live tx links |

## Honest scope

- **Real (testnet):** treasury contract + policy + rejection, agent autonomous payments,
  per-task accounting, muxed funding attribution, ERC-8004 identity (agent #1).
- **Demo shortcut:** the agent key is embedded (testnet-only) so the agent signs without a
  popup — deliberate, since the contract is the safety, not a human approval. Funding-rail
  deposits use XLM for a frictionless demo (USDC in production).
- **Roadmap:** on-chain reputation gate in `pay()` (the seam is already in the contract),
  anchor cash-out, x402 vendor endpoints.

## Likely questions

- *"Isn't bounded spend already solved?"* The bound is table-stakes; our edge is **cheap
  on-chain attribution** (muxed) + the **funding rail**, which competitors don't have.
- *"Why not Base/Solana where x402 lives?"* Micro-fee + muxed attribution + fiat anchors.
  Stellar is also shipping x402; we compose with it.
- *"Custody risk?"* None — funds never leave the owner's contract. We're software, not a bank.
