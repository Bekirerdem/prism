# Contracts & Addresses

Network: **Stellar Testnet** (`Test SDF Network ; September 2015`). Everything below is
live and verifiable on [stellar.expert](https://stellar.expert/explorer/testnet).

## Current contracts

| Contract | Address / hash |
| --- | --- |
| **Treasury v3.2 wasm** (current — every in-app create instantiates this) | `475cfbe2ca79d7977c8e4d29438ae70b9d95a12cb2bfcd9fed4e4f7a26d798b2` |
| **Treasury Registry** (cross-device backup) | [`CBEPVXK6…4ZE7`](https://stellar.expert/explorer/testnet/contract/CBEPVXK6BN2FZ3IYHV5KQUGROFHNBWBYHKHRZ5U3O7UWGIOPFOFE4ZE7) |
| **Compliance Verifier** (ZK, hardened) | [`CCOLX7NE…DBRH`](https://stellar.expert/explorer/testnet/contract/CCOLX7NEBDJRRVTPFVSK3UJLHMG3HO4UVYJW3NFBOTUG7Q7GOP63DBRH) |
| **Eunomia Policy** (OpenZeppelin ComplianceHooks) | `CBWMYGL7E663UON6ER5KQX2JZZA4UDZZD4RIFEHGXXF2HMMBRAN7BLQF` |

Treasury version history (v1 demo → v2 reputation+escrow → v3 sessions+lifecycle →
v3.1 audit hardening → v3.2 storage-TTL hardening) is recorded with upload transactions
in [`DEPLOYMENT.md`](https://github.com/eunomia-finance/eunomia/blob/main/DEPLOYMENT.md).

## Live on-chain proofs

| Claim | Proof |
| --- | --- |
| ZK compliance attested on-chain | [tx `4438c949…cac2a`](https://stellar.expert/explorer/testnet/tx/4438c94952d6d06fbf6b205e07be1c28ea33c5e1422a5323e93572788b9cac2a) → `ComplianceAttested` |
| Replay of the same period rejected | second verify traps (`already attested`) |
| Rogue payment to an unapproved address rejected | `Error(Contract, #2)` — funds never moved |
| Session key as sole spender, root key refused while Leash active | verified on the M2 smoke treasury |
| Reputation-gated payment (payee not approved, score ≥ threshold) | [tx `8d62132f…`](https://stellar.expert/explorer/testnet/tx/8d62132f4940f71758a351e68c8a7fe0f24b14207abf8c9c3eed6b3842c215cb) |

Contract test suites: treasury **51/51** · registry **3/3** · verifier **6/6** ·
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
