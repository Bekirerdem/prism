import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@stellar/stellar-sdk";
import { encodePaymentRequiredHeader } from "@x402/core/http";
import { makeBoundedFetch } from "./boundedFetch.js";
import type { GateResult, PaymentRequirements, TreasuryPolicy } from "./types.js";

const TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

function policy(over: Partial<TreasuryPolicy> = {}): TreasuryPolicy {
  return {
    perTaskLimit: 100000000n,
    dailyLimit: 200000000n,
    daySpent: 0n,
    token: TOKEN,
    isAllowedPayee: (p) => p === "GVENDOR",
    ...over,
  };
}

function paymentRequired402(amount: string): Response {
  // v2 carries PaymentRequired in the PAYMENT-REQUIRED header (base64), not the body.
  const accepts: PaymentRequirements[] = [
    {
      scheme: "exact",
      network: "stellar:testnet",
      amount,
      asset: TOKEN,
      payTo: "GVENDOR",
      maxTimeoutSeconds: 60,
      extra: { areFeesSponsored: true },
    },
  ];
  const paymentRequired = {
    x402Version: 2,
    resource: { url: "https://api.example.com/inference", description: "test", mimeType: "application/json" },
    accepts,
  };
  return new Response("payment required", {
    status: 402,
    headers: { "PAYMENT-REQUIRED": encodePaymentRequiredHeader(paymentRequired) },
  });
}

test("passes a non-402 response through untouched", async () => {
  let calls = 0;
  const fake: typeof fetch = async () => {
    calls++;
    return new Response("free content", { status: 200 });
  };

  const bounded = makeBoundedFetch({
    policy: policy(),
    agentSecret: Keypair.random().secret(),
    fetchImpl: fake,
  });

  const res = await bounded("https://api.example.com/free");
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "free content");
  assert.equal(calls, 1);
});

test("refuses an over-limit 402 before any payment is signed", async () => {
  let calls = 0;
  const fake: typeof fetch = async () => {
    calls++;
    return paymentRequired402("150000000"); // 15 XLM > 10 XLM per-task limit
  };

  const decisions: GateResult[] = [];
  const bounded = makeBoundedFetch({
    policy: policy(),
    agentSecret: Keypair.random().secret(),
    fetchImpl: fake,
    onDecision: (_req: PaymentRequirements, gate: GateResult) => decisions.push(gate),
  });

  await assert.rejects(() => bounded("https://api.example.com/inference"));
  assert.equal(calls, 1); // no paid retry — the request was never re-sent
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].allowed, false);
  assert.match(decisions[0].reason!, /per-task/);
});
