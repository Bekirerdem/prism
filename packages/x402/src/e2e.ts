// Live E2E: bounded x402 → real treasury pay() on Stellar testnet.
//
// Proves the two halves of "bounded x402" against the live v2 treasury:
//   1. an in-policy x402 payment is gated, then SETTLES on-chain through pay()
//   2. an over-limit x402 payment is gated OFF-CHAIN and never reaches pay()
//
// Read-only policy is fetched live; settlement goes through the same makeTreasurySettle
// seam that boundedPay uses in production. Requires the stellar CLI + the agent key
// (zk-deployer) in the OS keychain. Run from WSL:  npm run e2e
import { execFileSync } from "node:child_process";
import { boundedPay, makeTreasurySettle } from "./index.js";
import type { PaymentRequirements, TreasuryPolicy } from "./index.js";

const TREASURY = process.env.TREASURY_ID ?? "CDKQGDPLRX6DOCQTI5KVMZNGMPKMSRNGJRVCQ7LAAQGB2S5JKDCHXT5H";
const SOURCE = process.env.STELLAR_SOURCE ?? "zk-deployer";
const NETWORK = process.env.STELLAR_NETWORK ?? "testnet";
const PAYEE = process.env.X402_PAYEE ?? "GAEJSZY6RH3BESXKIYJRHHVCNRVIVOQ3QY3KKQPOU64NXD4WLB546CJI";
const TASK_ID = 402;

function view(method: string, args: string[] = []): string {
  return execFileSync(
    "stellar",
    ["contract", "invoke", "--id", TREASURY, "--source", SOURCE, "--network", NETWORK, "--", method, ...args],
    { encoding: "utf8" },
  ).trim();
}

// 1. Read the live policy off-chain — the snapshot boundedPay pre-flights against.
const cfg = JSON.parse(view("get_config")) as { token: string; daily_limit: string; per_task_limit: string };
const daySpent = BigInt(JSON.parse(view("day_spent")) as string);
const payeeWhitelisted = view("is_payee", ["--payee", PAYEE]) === "true";

const policy: TreasuryPolicy = {
  perTaskLimit: BigInt(cfg.per_task_limit),
  dailyLimit: BigInt(cfg.daily_limit),
  daySpent,
  token: cfg.token,
  isAllowedPayee: (p) => p === PAYEE && payeeWhitelisted,
};

console.log("treasury:", TREASURY);
console.log("policy:", {
  token: policy.token,
  perTaskLimit: policy.perTaskLimit.toString(),
  dailyLimit: policy.dailyLimit.toString(),
  daySpent: policy.daySpent.toString(),
  payeeWhitelisted,
});

const settle = makeTreasurySettle({ treasuryId: TREASURY, taskId: TASK_ID, source: SOURCE, network: NETWORK });

function reqFor(amount: bigint): PaymentRequirements {
  return {
    scheme: "exact",
    network: "stellar:testnet",
    amount: amount.toString(),
    asset: cfg.token,
    payTo: PAYEE,
    maxTimeoutSeconds: 60,
    extra: { areFeesSponsored: true },
  };
}

// 2. In-policy payment (1 XLM): gate allows → settles on-chain through the treasury.
const inPolicy = await boundedPay(reqFor(10_000_000n), policy, settle);
console.log("\n=== IN-POLICY (1 XLM) ===");
console.log("gate.allowed:", inPolicy.gate.allowed);
console.log("settled on-chain:", inPolicy.txHash ? "YES" : "NO");
if (inPolicy.txHash) console.log(inPolicy.txHash);

// 3. Over-limit payment (per_task_limit + 1): gated off-chain, never reaches pay().
const over = await boundedPay(reqFor(policy.perTaskLimit + 1n), policy, settle);
console.log("\n=== OVER-LIMIT (per_task_limit + 1) ===");
console.log("gate.allowed:", over.gate.allowed);
console.log("gate.reason:", over.gate.reason);
console.log("settled on-chain:", over.txHash ? "YES (BUG!)" : "NO — gated before settlement");

if (!inPolicy.txHash || over.txHash) {
  console.error("\nE2E FAILED: expected in-policy to settle and over-limit to be gated");
  process.exit(1);
}
console.log("\nE2E OK");
