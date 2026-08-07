import { test } from "node:test";
import assert from "node:assert/strict";
import { gateX402 } from "./gate.js";
import { boundedPay } from "./index.js";
import type { PaymentRequirements, TreasuryPolicy } from "./types.js";

const TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"; // testnet native XLM SAC (treasury v2 token)

// x402 v2 exact-scheme requirements (scheme_exact_stellar.md): `amount` is the
// v2 field name (v1's maxAmountRequired is unsupported on Stellar).
function req(over: Partial<PaymentRequirements> = {}): PaymentRequirements {
  return {
    scheme: "exact",
    network: "stellar:testnet", // CAIP-2
    amount: "50000000", // 5 XLM (7 decimals)
    asset: TOKEN,
    payTo: "GVENDOR",
    maxTimeoutSeconds: 60,
    extra: { areFeesSponsored: true },
    ...over,
  };
}

function policy(over: Partial<TreasuryPolicy> = {}): TreasuryPolicy {
  return {
    perTaskLimit: 100000000n, // 10 XLM
    dailyLimit: 200000000n, // 20 XLM
    daySpent: 0n,
    token: TOKEN,
    isAllowedPayee: (p) => p === "GVENDOR",
    ...over,
  };
}

test("allows a payment within policy to an allowed payee", () => {
  const r = gateX402(req(), policy());
  assert.equal(r.allowed, true);
  assert.equal(r.amount, 50000000n);
});

test("denies a scheme other than exact", () => {
  const r = gateX402(req({ scheme: "upto" }), policy());
  assert.equal(r.allowed, false);
  assert.match(r.reason!, /scheme/);
});

test("denies over the per-task limit", () => {
  const r = gateX402(req({ amount: "150000000" }), policy());
  assert.equal(r.allowed, false);
  assert.match(r.reason!, /per-task/);
});

test("denies when the daily limit would be exceeded", () => {
  const r = gateX402(req(), policy({ daySpent: 180000000n })); // 18 + 5 > 20
  assert.equal(r.allowed, false);
  assert.match(r.reason!, /daily/);
});

test("denies a payee that is neither whitelisted nor reputable", () => {
  const r = gateX402(req({ payTo: "GATTACKER" }), policy());
  assert.equal(r.allowed, false);
  assert.match(r.reason!, /payee/);
});

test("denies an asset mismatch", () => {
  const r = gateX402(req({ asset: "GSOMEOTHER" }), policy());
  assert.equal(r.allowed, false);
  assert.match(r.reason!, /asset/);
});

test("boundedPay settles only when allowed", async () => {
  let settled = 0;
  const settle = async () => {
    settled++;
    return "txhash123";
  };

  const ok = await boundedPay(req(), policy(), settle);
  assert.equal(ok.txHash, "txhash123");
  assert.equal(settled, 1);

  const denied = await boundedPay(req({ amount: "150000000" }), policy(), settle);
  assert.equal(denied.txHash, undefined);
  assert.equal(settled, 1); // settle NOT called again
});
