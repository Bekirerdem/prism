// Build gate: nothing that can sign on a real network may ship in the bundle.
//
// The in-app guard for the embedded demo key lives in src/config.ts, in the same file
// as the value it guards — so a rushed mainnet cutover can delete it to unblock a
// build. This check does not: it reads what was actually produced, runs as part of
// `npm run build`, and fails the build rather than warning.
//
// The policy it encodes, which is the one the project actually holds:
//
//   * the spectator demo deliberately embeds ONE throwaway testnet agent key, and
//     that is fine for exactly as long as the bundle still targets testnet;
//   * the moment the network constant changes, that same key is a real signing key
//     and must not be in a browser bundle at all;
//   * no OTHER secret seed may ever appear, whatever the network;
//   * the test-signer bypass must be folded away by the minifier — if the global
//     survives into the bundle it is reachable or near-reachable code, and it is
//     ready-made material for a "paste this in your console" script.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const DIST = new URL("../dist/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
/** The disclosed, worthless demo key (see SECURITY.md). Testnet only, by policy. */
const KNOWN_DEMO_KEY = "SC6F5K7IPNX6MMN2JAV766FU7WKWYQ3M34W3MOLCPXTU55HSKS2BT2XV";
const SECRET_SEED = /S[A-Z2-7]{55}/g;
const TEST_SIGNER = /__EUNOMIA_TEST_SIGNER__/g;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(js|mjs|cjs|html|css|map)$/.test(entry)) out.push(p);
  }
  return out;
}

// The network comes from the SOURCE, never from the bundle. Searching the bundle for
// the testnet passphrase looks reasonable and is wrong: stellar-sdk ships the same
// string in its own `Networks` constant, so the check would read "testnet" forever,
// including on the mainnet build it exists to stop.
const CONFIG = new URL("../src/config.ts", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1",
);
const declared = readFileSync(CONFIG, "utf8").match(
  /export const NETWORK_PASSPHRASE\s*=\s*"([^"]+)"/,
);
if (!declared) {
  console.error("check:no-secrets — could not read NETWORK_PASSPHRASE from src/config.ts");
  process.exit(1);
}
const targetsTestnet = declared[1] === TESTNET_PASSPHRASE;

const files = walk(DIST).map((path) => ({ path, body: readFileSync(path, "utf8") }));
const problems = [];

for (const { path, body } of files) {
  const where = path.replace(DIST, "dist/");

  for (const seed of body.match(SECRET_SEED) ?? []) {
    if (seed === KNOWN_DEMO_KEY && targetsTestnet) continue; // disclosed, testnet-only
    problems.push(
      seed === KNOWN_DEMO_KEY
        ? `${where}: the embedded demo key is present but this bundle no longer targets testnet — it is a live signing key now`
        : `${where}: an undeclared secret seed "${seed.slice(0, 12)}…" reached the bundle`,
    );
  }

  if (TEST_SIGNER.test(body)) {
    problems.push(
      `${where}: the test-signer global survived minification — the wallet bypass is in the published bundle`,
    );
    TEST_SIGNER.lastIndex = 0;
  }
}

if (problems.length) {
  console.error("\nBuild refused — check:no-secrets\n");
  for (const p of problems) console.error(`  ${p}`);
  console.error("\nMove signing server-side (api/relay.ts is the pattern) before shipping.\n");
  process.exit(1);
}

console.log(
  `check:no-secrets — ${files.length} built assets clean` +
    (targetsTestnet ? " (testnet bundle, demo key allowed)" : " (non-testnet bundle, no keys present)"),
);
