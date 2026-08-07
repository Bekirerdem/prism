import { test } from "node:test";
import assert from "node:assert/strict";
import { makeBoundedPolicy } from "./policy.js";
import type { GateResult, PaymentRequirements, TreasuryPolicy } from "./types.js";

const TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

function req(over: Partial<PaymentRequirements> = {}): PaymentRequirements {
  return {
    scheme: "exact",
    network: "stellar:testnet",
    amount: "50000000", // 5 XLM
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

test("keeps a requirement the gate allows", () => {
  const filter = makeBoundedPolicy(policy());
  const kept = filter(2, [req()]);
  assert.equal(kept.length, 1);
});

test("drops a requirement over the per-task limit", () => {
  const filter = makeBoundedPolicy(policy());
  const kept = filter(2, [req({ amount: "150000000" })]);
  assert.equal(kept.length, 0);
});

test("keeps only the in-policy option from a mixed list", () => {
  const filter = makeBoundedPolicy(policy());
  const kept = filter(2, [req({ amount: "150000000" }), req(), req({ payTo: "GATTACKER" })]);
  assert.deepEqual(
    kept.map((r) => r.payTo + ":" + r.amount),
    ["GVENDOR:50000000"],
  );
});

test("reports every decision with its reason", () => {
  const seen: Array<{ payTo: string; gate: GateResult }> = [];
  const filter = makeBoundedPolicy(policy(), (r, gate) => seen.push({ payTo: r.payTo, gate }));
  filter(2, [req(), req({ payTo: "GATTACKER" })]);

  assert.equal(seen.length, 2);
  assert.equal(seen[0].gate.allowed, true);
  assert.equal(seen[1].gate.allowed, false);
  assert.match(seen[1].gate.reason!, /payee/);
});
