# Contracts & Addresses

Network: **Stellar Testnet** (`Test SDF Network ; September 2015`). Everything below is
live and verifiable on [stellar.expert](https://stellar.expert/explorer/testnet).

## Current contracts

| Contract | Address / hash |
| --- | --- |
| **Treasury v3.4 wasm** (current — every in-app create instantiates this) | `b813a1e7a3d2ddb1013dbaa11a41dcc1fbed984a30cfef9023dc199b12131a72` |
| **Treasury Registry** (cross-device backup) | [`CBEPVXK6…4ZE7`](https://stellar.expert/explorer/testnet/contract/CBEPVXK6BN2FZ3IYHV5KQUGROFHNBWBYHKHRZ5U3O7UWGIOPFOFE4ZE7) |
| **Compliance Verifier** (ZK, bound to treasury state) | [`CCZKA3K4…D5Q`](https://stellar.expert/explorer/testnet/contract/CCZKA3K4SPIFWG7UBIY2CE7LPKPMCWROCHXZO2JAMYVVGU6TUKOWMD5Q) |
| **Eunomia Policy** (OpenZeppelin ComplianceHooks) | `CBWMYGL7E663UON6ER5KQX2JZZA4UDZZD4RIFEHGXXF2HMMBRAN7BLQF` |

Treasury version history (v1 demo → v2 reputation+escrow → v3 sessions+lifecycle →
v3.1 audit hardening → v3.2 storage-TTL hardening → v3.3 spend-window fixes →
v3.4 the surfaces a compliance proof binds to) is recorded with upload transactions
in [`DEPLOYMENT.md`](https://github.com/eunomia-finance/eunomia/blob/main/DEPLOYMENT.md).

## Live on-chain proofs

| Claim | Proof |
| --- | --- |
| ZK compliance attested on-chain | [tx `426e55d6…4606`](https://stellar.expert/explorer/testnet/tx/426e55d6ce0a9157c156190cee39dc2a1d302cf4c7f4f98cc930da5ad63b4606) → `attested` |
| A proof of a batch that never happened, rejected | `Error(Contract, #9)` — the total must match the treasury's own `period_spent` |
| Replay of the same period rejected | `Error(Contract, #8)` — periods only move forward |
| Rogue payment to an unapproved address rejected | `Error(Contract, #2)` — funds never moved |
| Session key as sole spender, root key refused while Leash active | verified on the M2 smoke treasury |
| Reputation-gated payment (payee not approved, score ≥ threshold) | [tx `8d62132f…`](https://stellar.expert/explorer/testnet/tx/8d62132f4940f71758a351e68c8a7fe0f24b14207abf8c9c3eed6b3842c215cb) |

Contract test suites: treasury **59/59** · registry **3/3** · verifier **17/17** ·
policy **2/2** (`cargo test`, run in CI).

## Error codes

A rejected payment is the product working — these are the reasons a call reverts:

| # | Error | Meaning |
| --- | --- | --- |
| 1 | `InvalidAmount` | Zero/negative amount |
| 2 | `PayeeNotWhitelisted` | Destination was never approved |
| 3 | `ExceedsTaskLimit` | Above the per-payment cap |
| 4 | `ExceedsDailyLimit` | Above what's left of the rolling 24h cap |
| 5 | `BelowReputationThreshold` | Reputation gate not cleared |
| 6 | `InsufficientFreeBalance` | Escrow-locked funds can't be spent |
| 7-8 | `EscrowNotFound` / `DeadlineNotReached` | Escrow lifecycle guards |
| 9 | `Paused` | Owner froze spending (withdraw still works) |
| 10 | `ExceedsSessionLimit` | Above the Leash's own cap |
| 11 | `InvalidLimits` | Rules must satisfy `0 < per-payment ≤ daily` |
| 12 | `InvalidDeadline` | Escrow deadline in the past |

## ERC-8004 registries (integration target)

Production reputation targets [trionlabs/stellar-8004](https://github.com/trionlabs/stellar-8004)
(SDK: `@trionlabs/8004-sdk`; agent id: `stellar:testnet:{identityRegistry}#{agentId}`):

| Registry | Testnet address |
| --- | --- |
| Identity | `CDE3K4COIAGWNNJQQLL26SYI3KBJF5FUDHXG5FA6GYDJCG7T5V7FIWZH` |
| Reputation | `CBZEAGIEI3HXMDRLF44KLQJQQOH6LCYWWSGJVSYQYQO2HQ6DDGZ7HT55` |
| Validation | `CC5USZRO26MOIAVNYTTJDS63C2OBBLREOAOET4CPF2EZWO3YFKLMO3SL` |
