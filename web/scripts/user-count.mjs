#!/usr/bin/env node
// Eunomia user counter — the evidence backbone for the "50 user wallets" program goal.
//
// Counts DISTINCT wallets that registered a treasury in the on-chain TreasuryRegistry
// (every in-app deploy best-effort-registers itself since M2). The RPC only retains
// events for a limited window, so each run MERGES what it finds into a cumulative
// snapshot at docs/metrics/registered-users.json — run it periodically (or before a
// submission) and the count never goes backwards.
//
// Usage:  node web/scripts/user-count.mjs            (from the repo root)
//         node scripts/user-count.mjs                (from web/)
// Wallets that predate the registry can be added by hand to the JSON's "owners" map
// (e.g. from the Supabase activity table's distinct wallet_address).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import { applyFunding } from "./qualify.mjs";

// Keep in sync with web/src/config.ts (plain .mjs can't import the TS module).
const RPC_URL = "https://soroban-testnet.stellar.org";
const REGISTRY_ID = "CBEPVXK6BN2FZ3IYHV5KQUGROFHNBWBYHKHRZ5U3O7UWGIOPFOFE4ZE7";
const XLM_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
// Any funded account works as a simulation source; nothing is signed or submitted.
const PROBE = "GCB32DDRIOE24JJ66IYB2V44UAYYPRA4UIPGQKM2OINHDK2NPW365XTA";
const TARGET = 50;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SNAPSHOT = join(repoRoot, "docs", "metrics", "registered-users.json");
const EXCLUDE = join(repoRoot, "docs", "metrics", "e2e-exclude.json");

/** Wallets that must never count as users (E2E smoke throwaways) — see the file's note. */
function loadExcluded() {
  if (!existsSync(EXCLUDE)) return new Set();
  try {
    return new Set(JSON.parse(readFileSync(EXCLUDE, "utf8")).wallets ?? []);
  } catch {
    console.error(`! ${EXCLUDE} is not valid JSON — excluding nothing this run.`);
    return new Set();
  }
}

/** The ledger a getEvents paging cursor points at (TOID's high 32 bits); 0 if unparsable. */
function cursorLedger(cursor) {
  const toid = String(cursor ?? "").split("-")[0];
  if (!toid || !/^\d+$/.test(toid)) return 0;
  return Number(BigInt(toid) >> 32n);
}

/** Every `regd` event in the RPC's retained window: { owner, treasury, at }. */
async function fetchRegistrations() {
  const server = new rpc.Server(RPC_URL);
  const health = await server.getHealth();
  const start = Math.max(1, (health.oldestLedger ?? 1) + 1);
  const filters = [{ type: "contract", contractIds: [REGISTRY_ID] }];

  const out = [];
  let res = await server.getEvents({ startLedger: start, filters, limit: 1000 });
  for (let pages = 1; ; pages++) {
    for (const e of res.events) {
      const topics = e.topic.map((t) => scValToNative(t));
      if (String(topics[0]) !== "regd") continue;
      out.push({ owner: String(topics[1]), treasury: String(scValToNative(e.value)), at: e.ledgerClosedAt });
    }
    const behindHead = res.cursor && res.latestLedger > 0 && cursorLedger(res.cursor) <= res.latestLedger;
    if (!behindHead || pages >= 50) break;
    const before = cursorLedger(res.cursor);
    res = await server.getEvents({ cursor: res.cursor, filters, limit: 1000 });
    // Head-stall: RPC caught up to head and is returning the same empty position — stop
    // instead of spinning to the 50-page guard (mirrors pageToHead in web/src/lib/events.ts).
    if (res.events.length === 0 && cursorLedger(res.cursor) <= before) break;
  }
  return out;
}

/** XLM a treasury holds, read from the native SAC by simulation. Null when unreadable —
 *  treated as "no evidence of funding", never as evidence of absence. */
async function treasuryBalance(server, contractId) {
  try {
    const tx = new TransactionBuilder(new Account(PROBE, "0"), {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(new Contract(XLM_SAC).call("balance", new Address(contractId).toScVal()))
      .setTimeout(30)
      .build();
    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) return null;
    return Number(scValToNative(sim.result.retval)) / 10_000_000;
  } catch {
    return null;
  }
}

/** Owners with at least one treasury holding value right now. */
async function fundedOwners(owners) {
  const server = new rpc.Server(RPC_URL);
  const found = new Set();
  for (const [owner, entry] of Object.entries(owners)) {
    if (entry.funded) continue; // already established; the flag is sticky
    for (const treasury of entry.treasuries) {
      if ((await treasuryBalance(server, treasury)) > 0) {
        found.add(owner);
        break;
      }
    }
  }
  return found;
}

function loadSnapshot() {
  if (!existsSync(SNAPSHOT)) return { target: TARGET, owners: {} };
  try {
    return JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  } catch {
    console.error(`! ${SNAPSHOT} is not valid JSON — starting fresh (old file left untouched until save).`);
    return { target: TARGET, owners: {} };
  }
}

const registrations = await fetchRegistrations();
const excluded = loadExcluded();
const snap = loadSnapshot();
snap.target = TARGET;

let pruned = 0;
for (const owner of Object.keys(snap.owners)) {
  if (excluded.has(owner)) {
    delete snap.owners[owner];
    pruned++;
  }
}

let newOwners = 0;
let newTreasuries = 0;
for (const { owner, treasury, at } of registrations) {
  if (excluded.has(owner)) continue;
  const entry = (snap.owners[owner] ??= { treasuries: [], firstSeen: at });
  if (!entry.treasuries.includes(treasury)) {
    if (entry.treasuries.length === 0) newOwners++; // first treasury ⇒ new wallet
    entry.treasuries.push(treasury);
    newTreasuries++;
  }
}
const { active, pending } = applyFunding(snap.owners, await fundedOwners(snap.owners));
snap.updatedAt = new Date().toISOString();

mkdirSync(dirname(SNAPSHOT), { recursive: true });
writeFileSync(SNAPSHOT, JSON.stringify(snap, null, 2) + "\n");

const count = Object.keys(snap.owners).length;
const bar = "█".repeat(Math.min(active, TARGET)) + "░".repeat(Math.max(0, TARGET - active));
// `active` is the number to publish: registering is free (the relay sponsors the fee), so
// only owners who moved value into a treasury carry evidence weight. See scripts/qualify.mjs.
console.log(`\nEunomia active wallets: ${active} / ${TARGET}`);
console.log(bar);
console.log(`(${count} registered in total — ${pending} deployed a treasury but never funded it)`);
console.log(`(this run: +${newOwners} new wallet(s), +${newTreasuries} treasury registration(s) in the RPC window)`);
if (excluded.size > 0) console.log(`(excluding ${excluded.size} own/E2E wallet(s); pruned ${pruned} from the snapshot this run)`);
console.log(`snapshot: ${SNAPSHOT}\n`);
for (const [owner, e] of Object.entries(snap.owners)) {
  const mark = e.funded ? "active " : "pending";
  console.log(`  ${mark}  ${owner}  treasuries: ${e.treasuries.length}  first seen: ${e.firstSeen}`);
}
