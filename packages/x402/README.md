# eunomia-x402 — bounded x402 buyer

The safe wallet behind an agent's [x402](https://developers.stellar.org/docs/build/agentic-payments/x402) payments on Stellar.

When a service replies `402 Payment Required`, an agent normally signs a payment for
whatever the server asks. **eunomia-x402 gates that payment against the treasury policy
first** — per-task limit, daily limit, and the payee whitelist OR reputation gate — and
only settles through the bounded treasury if it passes. An over-limit or wrong-payee
x402 request never reaches settlement.

```ts
import { boundedPay, makeTreasurySettle } from "eunomia-x402";

const settle = makeTreasurySettle({ treasuryId, taskId });
const result = await boundedPay(requirements, policy, settle);
//  requirements: parsed from the server's 402 response
//  policy:       a snapshot of the treasury's limits + payee gate
//  settle:       pays through the v2 treasury's pay() (the on-chain enforcement)
if (!result.gate.allowed) console.log("refused:", result.gate.reason);
else console.log("paid, tx:", result.txHash);
```

`gateX402` mirrors the on-chain gate so the agent never attempts a payment the contract
would reject; `treasury.pay` is the final, on-chain word.

## Live settlement (`npm run e2e`)

`makeTreasurySettle` is the production `settle`: it invokes the v2 treasury's
`pay(task_id, to, amount)` through the stellar CLI, so the bounded contract enforces
policy at settlement time and the agent key stays in the OS keychain (never in code).

The E2E runs against the **live testnet treasury** and proves both halves:

- **In-policy** → gated, then settled on-chain. e.g. tx [`8a1a887a…`](https://stellar.expert/explorer/testnet/tx/8a1a887ac32b700d7e2ad2d28d64760003529c8d804be600891b162eba8ada1a) (treasury `transfer` + `paid` events).
- **Over-limit** → gated **off-chain**, never reaches `pay()`.

- **Asset:** native XLM via its SAC `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` — the v2 treasury's token.
- **Treasury (v2, testnet):** `CDKQGDPLRX6DOCQTI5KVMZNGMPKMSRNGJRVCQ7LAAQGB2S5JKDCHXT5H`.

## Standards-compliant interop (`npm run e2e:interop`)

The full x402 **v2** handshake — fetch → 402 → gate → pay → retry → 200 — through the
official [`@x402/stellar`](https://www.npmjs.com/package/@x402/stellar) client and
facilitator implementation, proven live on testnet with the **funded agent account**
architecture:

- **Bounded allowance:** the treasury funds the agent's spending account through
  `pay()` — the allowance itself is policy-checked and attributed on-chain
  (tx [`70511db2…`](https://stellar.expert/explorer/testnet/tx/70511db2f45533b001b01eb2335182aa2d4f6e96902198d0a3b20d372e2b9d71)).
  The treasury key never touches the HTTP handshake.
- **In-policy** 1 XLM request → gated, auth-entry signed by the agent, settled by the
  facilitator with sponsored fees — tx
  [`c93de1e8…`](https://stellar.expert/explorer/testnet/tx/c93de1e8dd69e410e4403d64e7babb55fa6aac685e179bb879210ae83f5ecafb).
- **Over-limit** 15 XLM request → refused by the gate inside the official client's
  policy seam (`x402Client.registerPolicy`), **before any signature exists**.

`makeBoundedFetch({ policy, agentSecret })` builds the paying fetch;
`makeBoundedPolicy` adapts `gateX402` to the client's `PaymentPolicy` seam, with an
`onDecision` callback so refusals stay visible. The E2E's resource server verifies and
settles through `x402Facilitator` — the same class a hosted facilitator runs (the
hosted OpenZeppelin testnet facilitator currently requires an API key, so the E2E
hosts its own instance of the official implementation).
