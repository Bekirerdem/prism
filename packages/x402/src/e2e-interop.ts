// Live E2E: standards-compliant x402 interop on Stellar testnet.
//
// Proves the full "funded agent account" architecture end to end:
//   1. the TREASURY funds the agent's spending account through pay() — the
//      allowance itself is policy-bounded and on-chain
//   2. a real HTTP 402 handshake (fetch -> 402 -> pay -> retry -> 200) settles
//      through the OFFICIAL x402 facilitator implementation (@x402/stellar),
//      auth-entry signed by the agent, fees sponsored by the facilitator
//   3. an over-limit 402 is refused by the bounded gate BEFORE any signature
//
// The demo resource server speaks wire-format v2 (PAYMENT-REQUIRED /
// PAYMENT-SIGNATURE / PAYMENT-RESPONSE headers) via @x402/core's own
// encoders, and verifies+settles through x402Facilitator — the same class a
// hosted facilitator runs. Requires the stellar CLI + zk-deployer keychain
// identity (treasury admin). Run from WSL:  npm run e2e:interop
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { execFileSync } from "node:child_process";
import { Keypair } from "@stellar/stellar-sdk";
import { x402Facilitator } from "@x402/core/facilitator";
import {
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from "@x402/core/http";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme as FacilitatorScheme } from "@x402/stellar/exact/facilitator";
import { makeBoundedFetch } from "./boundedFetch.js";
import { makeTreasurySettle } from "./settle.js";
import type { PaymentRequirements, TreasuryPolicy } from "./types.js";

const TREASURY = process.env.TREASURY_ID ?? "CDKQGDPLRX6DOCQTI5KVMZNGMPKMSRNGJRVCQ7LAAQGB2S5JKDCHXT5H";
const SOURCE = process.env.STELLAR_SOURCE ?? "zk-deployer";
const NETWORK = process.env.STELLAR_NETWORK ?? "testnet";
const TASK_ID = 403; // x402 allowance top-ups are attributed to this task
const TOP_UP = 20_000_000n; // 2 XLM allowance from the treasury
const PRICE_OK = "10000000"; // 1 XLM — inside the per-task limit
const PRICE_OVER = "150000000"; // 15 XLM — over the per-task limit

function view(method: string, args: string[] = []): string {
  return execFileSync(
    "stellar",
    ["contract", "invoke", "--id", TREASURY, "--source", SOURCE, "--network", NETWORK, "--", method, ...args],
    { encoding: "utf8" },
  ).trim();
}

async function friendbot(addr: string): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${addr}`);
  if (!res.ok && res.status !== 400) throw new Error(`friendbot ${addr}: ${res.status}`); // 400 = already funded
}

function ensurePayee(addr: string): void {
  if (view("is_payee", ["--payee", addr]) !== "true") {
    view("add_payee", ["--payee", addr]);
  }
}

// --- 1. Accounts: agent (spender), vendor (payTo), facilitator (fee sponsor)
const agent = Keypair.random();
const vendor = Keypair.random();
const facilitatorKey = Keypair.random();
console.log("agent:      ", agent.publicKey());
console.log("vendor:     ", vendor.publicKey());
console.log("facilitator:", facilitatorKey.publicKey());
await Promise.all([friendbot(agent.publicKey()), friendbot(vendor.publicKey()), friendbot(facilitatorKey.publicKey())]);

// --- 2. Treasury funds the agent's allowance — bounded, attributed, on-chain
ensurePayee(agent.publicKey());
ensurePayee(vendor.publicKey()); // the x402 payee is policy-approved too
const settleFromTreasury = makeTreasurySettle({ treasuryId: TREASURY, taskId: TASK_ID, source: SOURCE, network: NETWORK });
const topUpTx = await settleFromTreasury(agent.publicKey(), TOP_UP);
console.log("\nallowance top-up (treasury pay):", topUpTx);

// --- 3. Policy snapshot AFTER the top-up (day_spent moved)
const cfg = JSON.parse(view("get_config")) as { token: string; daily_limit: string; per_task_limit: string };
const daySpent = BigInt(JSON.parse(view("day_spent")) as string);
const policy: TreasuryPolicy = {
  perTaskLimit: BigInt(cfg.per_task_limit),
  dailyLimit: BigInt(cfg.daily_limit),
  daySpent,
  token: cfg.token,
  isAllowedPayee: (p) => p === vendor.publicKey(),
};
console.log("policy:", { perTaskLimit: cfg.per_task_limit, dailyLimit: cfg.daily_limit, daySpent: daySpent.toString() });

// --- 4. Demo 402 resource server + the OFFICIAL facilitator, in-process
const facilitator = new x402Facilitator().register(
  "stellar:testnet",
  new FacilitatorScheme([createEd25519Signer(facilitatorKey.secret(), "stellar:testnet")]),
);
let settlements = 0;

function requirementsFor(amount: string): PaymentRequirements {
  return {
    scheme: "exact",
    network: "stellar:testnet",
    amount,
    asset: cfg.token,
    payTo: vendor.publicKey(),
    maxTimeoutSeconds: 60,
    extra: { areFeesSponsored: true },
  };
}

const server = createServer(async (req, res) => {
  const url = `http://${req.headers.host}${req.url}`;
  const price = req.url === "/expensive" ? PRICE_OVER : PRICE_OK;
  const accepts = [requirementsFor(price)];
  const paymentHeader = req.headers["payment-signature"] ?? req.headers["x-payment"];

  if (!paymentHeader || Array.isArray(paymentHeader)) {
    res.writeHead(402, {
      "PAYMENT-REQUIRED": encodePaymentRequiredHeader({
        x402Version: 2,
        resource: { url, description: "inference", mimeType: "application/json" },
        accepts,
      }),
    });
    res.end("payment required");
    return;
  }

  try {
    const payload = decodePaymentSignatureHeader(paymentHeader);
    const verdict = await facilitator.verify(payload, accepts[0]);
    if (!verdict.isValid) throw new Error(`verify failed: ${verdict.invalidReason}`);
    const settled = await facilitator.settle(payload, accepts[0]);
    if (!settled.success) throw new Error(`settle failed: ${settled.errorReason}`);
    settlements++;
    res.writeHead(200, {
      "content-type": "application/json",
      "PAYMENT-RESPONSE": encodePaymentResponseHeader(settled),
    });
    res.end(JSON.stringify({ answer: 42, paidTx: settled.transaction }));
  } catch (e) {
    res.writeHead(402, { "payment-error": (e as Error).message });
    res.end("payment rejected");
  }
});
await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
const port = (server.address() as AddressInfo).port;
console.log(`\ndemo 402 server on :${port} (facilitator = official @x402/stellar, in-process)`);

// --- 5. The bounded agent pays for the resource — real 402 handshake
const decisions: string[] = [];
const bounded = makeBoundedFetch({
  policy,
  agentSecret: agent.secret(),
  onDecision: (r, g) => decisions.push(`${g.allowed ? "ALLOW" : "REFUSE"} ${r.amount} -> ${r.payTo.slice(0, 4)}… ${g.reason ?? ""}`),
});

console.log("\n=== IN-POLICY (1 XLM) ===");
const okRes = await bounded(`http://127.0.0.1:${port}/inference`);
const okBody = (await okRes.json()) as { paidTx: string };
console.log("status:", okRes.status);
console.log("settled on-chain:", okBody.paidTx);

console.log("\n=== OVER-LIMIT (15 XLM) ===");
let refused = false;
try {
  await bounded(`http://127.0.0.1:${port}/expensive`);
} catch (e) {
  refused = true;
  console.log("refused before signing:", (e as Error).message);
}

console.log("\ngate decisions:");
for (const d of decisions) console.log("  " + d);

server.close();

if (okRes.status !== 200 || !okBody.paidTx || !refused || settlements !== 1) {
  console.error("\nE2E FAILED: expected one settled payment and one refusal", {
    status: okRes.status,
    settlements,
    refused,
  });
  process.exit(1);
}
console.log("\nE2E OK — bounded x402 interop proven end to end");
