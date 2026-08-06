// Emits the default compliant sample input for the compliance circuit (the contract
// test fixture). Thin wrapper over the parametric prover's buildInput — one source of
// truth for how a batch becomes a circuit input.
import { writeFileSync, mkdirSync } from "node:fs";
import { buildInput, type ComplianceBatch } from "./prove.js";

const DEFAULT: ComplianceBatch = {
  payments: [
    { amount: 100n, payee: 11n },
    { amount: 200n, payee: 22n },
    { amount: 50n, payee: 33n },
  ], // sum 350 <= 1000, each <= 300
  whitelist: [11n, 22n, 33n],
  dailyLimit: 1000n,
  perTaskLimit: 300n,
  periodId: 1n,
  periodSpent: 350n, // the batch accounts for the whole period, as a real one must
};

async function main() {
  const input = await buildInput(DEFAULT);
  mkdirSync("inputs/compliance", { recursive: true });
  writeFileSync("inputs/compliance/default.json", JSON.stringify(input, null, 2));
  console.log("wrote inputs/compliance/default.json  (root=" + input.whitelistRoot + ")");
}

main();
