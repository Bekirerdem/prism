// End-to-end live pipeline: read a treasury's real policy and period total off-chain,
// prove a batch against them, and submit it to the verifier on testnet.
//
// The point of running this against a live treasury (rather than a fixture) is that
// nothing here is ours to choose: the limits, the payee root and the period's total all
// come from the chain, and the verifier re-reads every one of them. A batch that does
// not match is refused on-chain, which is the property the 08-05 audit found missing.
//
// Run in WSL (needs circom/snarkjs + the stellar CLI keychain).
//
//   npx tsx scripts/prove-and-submit.ts --treasury <C...> --period <N>
//     [--payments 100:11,200:22]   real batch; omitted means the period was quiet
//     [--force]                    prove a batch that contradicts the chain, to watch
//                                  the verifier reject it
import { execFileSync } from "node:child_process";
import { proveCompliance, type CompliancePayment } from "./prove.js";
import { submitProof } from "../../packages/prover/src/submit.js";

// N=16 verifier (2026-08-07). Its predecessor CCZKA3K4… expects 13 public signals and
// cannot check a 16-slot batch — proofs from this build do not verify against it.
const VERIFIER = "CD3TB3F4VQF2H56IQC4KV3YLA6QRIF272W5D6PK2SWVTYPXHS4NFDYZ3";
const SOURCE = "zk-deployer";
const NETWORK = "testnet";
// The payee field elements the whitelist tree is built over. Mapping real Stellar
// addresses onto field elements is a separate piece of work — until then the tree is a
// declared payee set, not one derived from the treasury's actual allowlist
// (SECURITY.md, "Known limitations").
const WHITELIST = [11n, 22n, 33n];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Read-only contract call, returned as its raw JSON output. */
function read(id: string, fn: string, ...args: string[]): string {
  return execFileSync(
    "stellar",
    ["contract", "invoke", "--id", id, "--source", SOURCE, "--network", NETWORK, "--", fn, ...args],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}

function parsePayments(spec: string | undefined): CompliancePayment[] {
  if (!spec) return [];
  return spec.split(",").map((p) => {
    const [amount, payee] = p.split(":");
    return { amount: BigInt(amount), payee: BigInt(payee) };
  });
}

async function main() {
  const treasury = arg("treasury");
  const period = arg("period");
  if (!treasury || !period) {
    throw new Error("usage: --treasury <C...> --period <N> [--payments a:p,...] [--force]");
  }
  const force = process.argv.includes("--force");

  // Everything the proof must agree with, straight from the treasury.
  const cfg = JSON.parse(read(treasury, "get_config"));
  const root = JSON.parse(read(treasury, "whitelist_root"));
  // i128 comes back JSON-quoted ("350"), so parse before widening to BigInt.
  const onChainSpent = BigInt(JSON.parse(read(treasury, "period_spent", "--period_id", period)));
  console.log(
    `treasury ${treasury}\n  daily=${cfg.daily_limit} perTask=${cfg.per_task_limit}` +
      `\n  root=${root}\n  period ${period} spent ${onChainSpent} on-chain`,
  );

  const payments = parsePayments(arg("payments"));
  const batchTotal = payments.reduce((a, p) => a + p.amount, 0n);
  // With --force we prove what the batch actually says, even though the chain disagrees,
  // so the rejection happens where it should: on-chain, not in this script.
  const periodSpent = force ? batchTotal : onChainSpent;
  if (force && batchTotal !== onChainSpent) {
    console.log(`  --force: proving a batch of ${batchTotal} against a chain that says ${onChainSpent}`);
  }

  const res = await proveCompliance(
    {
      payments,
      whitelist: WHITELIST,
      dailyLimit: BigInt(cfg.daily_limit),
      perTaskLimit: BigInt(cfg.per_task_limit),
      periodId: BigInt(period),
      periodSpent,
    },
    "live",
  );
  console.log(`proved: proof ${res.proof.length}B, public ${res.publicSignals.length}B`);

  const out = submitProof({
    verifierId: VERIFIER,
    treasuryId: treasury,
    proof: res.proof,
    publicSignals: res.publicSignals,
    source: SOURCE,
    network: NETWORK,
  });
  console.log(out.ok ? "SUBMITTED ✅\n" + out.output : "REJECTED ❌\n" + out.output);
  if (!out.ok) process.exit(1);
}

main();
