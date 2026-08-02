// Eunomia — testnet configuration. All values are public testnet artifacts.
// The agent secret is a TESTNET-only key with no real value; embedding it lets the
// dashboard demonstrate an *autonomous* agent that signs its own payments (no wallet
// popup) — the whole point is that the contract, not a human click, is the safety.

export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const EXPLORER = "https://stellar.expert/explorer/testnet";

export const TREASURY_ID = "CAYWNXHANRY5GSJAZOR4YTKBKNOKTCITE52ZRKDKCAWLDTYWFFVFSPAZ";
// Hardened ZK compliance verifier (policy binding + replay guard) — emits `attested`.
export const VERIFIER_ID = "CCOLX7NEBDJRRVTPFVSK3UJLHMG3HO4UVYJW3NFBOTUG7Q7GOP63DBRH";
// Live on-chain compliance attestation — the verify() tx that emitted `ComplianceAttested`.
// A 2nd verify of the same periodId traps (replay guard), so this proof is shown, not re-run.
export const ATTESTED_TX = "4438c94952d6d06fbf6b205e07be1c28ea33c5e1422a5323e93572788b9cac2a";
export const USDC_SAC = "CDCEHPK4OJXVRA4JV7N56GR5SRD5KGGZ55BDSHKODGR72Y4KGS6A3Y2W";

export const ADMIN = "GDPKXL6CNHUXBV4PM54CPTRZNQRYVTIMO4YGBW3M2MNSCMQ7TTNINXP6";
export const AGENT_PK = "GDAOXABLEOFZP2M4PRM7N6YKOKXWMPFOSLU35WL5ZQY4PQFHF3VCIDS6";
export const AGENT_SECRET = "SC6F5K7IPNX6MMN2JAV766FU7WKWYQ3M34W3MOLCPXTU55HSKS2BT2XV";

// ⚠️ SAFETY GUARD — the embedded AGENT_SECRET is a throwaway TESTNET key. A real signing
// key must NEVER live in frontend code: it ships verbatim inside the JS bundle. If this
// build is ever pointed at a non-testnet network, refuse to load — move signing to a
// backend proxy or a wallet (e.g. Freighter) first.
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
if (NETWORK_PASSPHRASE !== TESTNET_PASSPHRASE) {
  throw new Error(
    "Eunomia: the embedded AGENT_SECRET is testnet-only. On a non-testnet network, signing " +
      "MUST move to a backend proxy or wallet (e.g. Freighter). Refusing to load a bundled secret.",
  );
}

export const SERVICE = "GDOMW4C36BUBBFJW3V4L22LUICOUKFVTPGOYU6UMZZ6D3ENEOCH4QCRT";
export const ATTACKER = "GAKSMBN6TRMF4M4PL3FJSDMQRD6XBQCJFLECLYTNAXZYMRIWXT6ADYTC";
// Funding pool — one classic G-account whose zero-cost muxed sub-addresses
// attribute incoming deposits to individual agent budgets (no memos, no new accounts).
export const POOL_PK = "GD2NZKSMQW367OIFXRM4NP7RIW6YLDZLJ4C7253MDOKCFC4Q4IOO3427";

// Eunomia Treasury Registry — permissionless wallet → treasury discovery index,
// used for cross-device recovery of per-user treasuries (M2).
export const REGISTRY_ID = "CBEPVXK6BN2FZ3IYHV5KQUGROFHNBWBYHKHRZ5U3O7UWGIOPFOFE4ZE7";

// --- Passkey (smart wallet) --------------------------------------------------------
// The smart-wallet WASM passkey-kit deploys for each new passkey user.
export const WALLET_WASM_HASH =
  "fdefad64b96837147e1c333e51f537b696eab925e9f147e63d597c04e3c903f0";
// WebAuthn Relying Party id. A passkey is bound to this domain: change it and every passkey
// created before the change stops resolving. Left undefined in dev so the kit falls back to
// the current origin (localhost), which is the only value that works there.
// Read defensively: this module is also loaded outside Vite (Playwright config), where
// import.meta.env does not exist at all.
const IS_PROD = (import.meta as { env?: { PROD?: boolean } }).env?.PROD === true;
export const RP_ID: string | undefined = IS_PROD ? "eunomia.finance" : undefined;

// 8004 (trionlabs/stellar-8004) testnet registries — the agent trust layer.
export const REG_IDENTITY = "CDE3K4COIAGWNNJQQLL26SYI3KBJF5FUDHXG5FA6GYDJCG7T5V7FIWZH";
export const REG_REPUTATION = "CBZEAGIEI3HXMDRLF44KLQJQQOH6LCYWWSGJVSYQYQO2HQ6DDGZ7HT55";
export const AGENT_8004_ID = 1; // the agent is registered as #1 on testnet

export const USDC_UNIT = 10_000_000n; // 1 USDC (7 decimals)

export interface AgentTask {
  taskId: bigint;
  name: string;
  vendor: string;
  payee: string;
  amount: bigint;
}

// The legitimate jobs the autonomous agent runs (all within policy limits) — the
// real things an AI agent pays for: inference, data, and compute (pay-per-use).
export const TASKS: AgentTask[] = [
  { taskId: 101n, name: "LLM inference · 4.2M tokens", vendor: "Inference API", payee: SERVICE, amount: 3n * USDC_UNIT },
  { taskId: 102n, name: "Real-time market data", vendor: "Data feed", payee: SERVICE, amount: 2n * USDC_UNIT },
  { taskId: 103n, name: "GPU compute · 2.5 hrs", vendor: "Compute cloud", payee: SERVICE, amount: 4n * USDC_UNIT },
];

// The prompt-injection / rogue scenario: agent told to send funds to an unapproved wallet.
export const ROGUE: AgentTask = {
  taskId: 666n,
  name: "Drain to attacker wallet",
  vendor: "Unapproved wallet (prompt-injection)",
  payee: ATTACKER,
  amount: 5n * USDC_UNIT,
};

export interface Budget {
  id: bigint;
  name: string;
}

// Each budget is a zero-cost muxed sub-address of the same pool account.
export const BUDGETS: Budget[] = [
  { id: 1n, name: "Research agent" },
  { id: 2n, name: "Marketing agent" },
  { id: 3n, name: "Ops agent" },
];

export function fmtUSDC(stroops: bigint, maxFrac = 2): string {
  const neg = stroops < 0n;
  const v = neg ? -stroops : stroops;
  const whole = v / USDC_UNIT;
  const frac = v % USDC_UNIT;
  const fracStr = frac.toString().padStart(7, "0").slice(0, maxFrac).replace(/0+$/, "");
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + wholeStr + (fracStr ? "." + fracStr : "");
}

/** XLM and USDC are both 7-decimal; fmtUSDC is pure math, so reuse it and label XLM. */
export const fmtXlm = (stroops: bigint) => fmtUSDC(stroops, 4);

export function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

export function txUrl(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export function contractUrl(id: string): string {
  return `${EXPLORER}/contract/${id}`;
}
