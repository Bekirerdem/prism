// Testnet-only starting funds for passkey users.
//
// Friendbot funds classic accounts only, and Stellar's classic payment operation cannot target
// a contract address — so a passkey user's smart wallet has no way to receive test XLM. This
// endpoint closes that gap with a SAC transfer from a funding account we control.
//
// It has NO mainnet counterpart: there, users bring their own funds. The dispenser secret is a
// throwaway testnet key held server-side; it never reaches the browser bundle.
import {
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
// Explicit .js extension: Vercel compiles api/* with node16 resolution, where an extensionless
// relative import does not resolve and the function dies at cold start with a 500. The local
// bundler config maps .js back to .ts, so this satisfies both.
import process from "node:process";
import { dispenseDecision, DISPENSE_XLM } from "../src/lib/dispenser.js";

const clean = (v: string | undefined): string => (v ?? "").replace(/[^\x20-\x7E]/g, "").trim();

const RPC_URL = clean(process.env.RELAY_RPC_URL) || "https://soroban-testnet.stellar.org";
const HORIZON = clean(process.env.FAUCET_HORIZON_URL) || "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
// Native XLM SAC on testnet — the only way to move value into a contract account.
const XLM_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const STROOPS = 10_000_000;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Native balance of a classic account; 0 when it does not exist. */
async function accountBalance(publicKey: string): Promise<number> {
  const res = await fetch(`${HORIZON}/accounts/${publicKey}`);
  if (!res.ok) return 0;
  const body = (await res.json()) as { balances?: Array<{ asset_type: string; balance: string }> };
  return Number(body.balances?.find((b) => b.asset_type === "native")?.balance ?? 0);
}

/** A contract account's XLM balance lives in the SAC, not in Horizon's account record.
 *  Simulated only — nothing is submitted, so the dispenser just supplies a valid source. */
async function walletBalance(server: rpc.Server, source: Keypair, wallet: string): Promise<number> {
  try {
    const tx = new TransactionBuilder(await server.getAccount(source.publicKey()), {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(new Contract(XLM_SAC).call("balance", new Address(wallet).toScVal()))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) return 0;
    return Number(scValToNative(sim.result.retval) as bigint) / STROOPS;
  } catch {
    return 0;
  }
}

/** Friendbot cannot top up an existing account, so a refill means funding a NEW account and
 *  merging it in — which transfers its whole balance and closes it. */
async function refill(server: rpc.Server, dispenser: Keypair): Promise<void> {
  const donor = Keypair.random();
  const funded = await fetch(`${HORIZON}/friendbot?addr=${donor.publicKey()}`);
  if (!funded.ok) throw new Error("friendbot refused to fund a donor account");

  const tx = new TransactionBuilder(await server.getAccount(donor.publicKey()), {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.accountMerge({ destination: dispenser.publicKey() }))
    .setTimeout(60)
    .build();
  tx.sign(donor);
  await server.sendTransaction(tx);
}

/** Move XLM into a contract account. Classic payments cannot do this; the SAC can. */
async function sendToWallet(
  server: rpc.Server,
  dispenser: Keypair,
  wallet: string,
  amountXlm: number,
): Promise<string | undefined> {
  const built = new TransactionBuilder(await server.getAccount(dispenser.publicKey()), {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      new Contract(XLM_SAC).call(
        "transfer",
        new Address(dispenser.publicKey()).toScVal(),
        new Address(wallet).toScVal(),
        nativeToScVal(BigInt(Math.round(amountXlm * STROOPS)), { type: "i128" }),
      ),
    )
    .setTimeout(120)
    .build();

  const prepared = await server.prepareTransaction(built);
  prepared.sign(dispenser);
  return (await server.sendTransaction(prepared)).hash;
}

// Exported as named HTTP methods, not as `export default`. Vercel treats a default export as
// the legacy `(req, res) => void` signature and ignores whatever it returns — so a handler
// written against the Web `Request`/`Response` API produced no response at all and the request
// hung until it timed out. Named methods select the fetch-style signature.
async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = clean(process.env.DISPENSER_SECRET);
  let dispenser: Keypair | null = null;
  try {
    if (secret) dispenser = Keypair.fromSecret(secret);
  } catch {
    dispenser = null;
  }
  if (!dispenser) return json({ error: "Faucet is not configured." }, 503);

  let body: { wallet?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "Malformed request." }, 400);
  }
  const wallet = typeof body.wallet === "string" ? body.wallet : "";

  const server = new rpc.Server(RPC_URL);
  const decision = await dispenseDecision(wallet, {
    // One allocation per wallet: a wallet that already holds XLM has been served.
    alreadyServed: async (w) => (await walletBalance(server, dispenser, w)) > 0,
    dispenserBalance: () => accountBalance(dispenser.publicKey()),
  });

  if (decision.action === "invalid") return json({ error: "That is not a smart wallet address." }, 400);
  if (decision.action === "already-served") return json({ error: "This wallet already has funds." }, 409);

  try {
    if (decision.action === "refill-then-dispense") await refill(server, dispenser);
    const hash = await sendToWallet(server, dispenser, wallet, DISPENSE_XLM);
    return json({ hash, amount: DISPENSE_XLM }, 200);
  } catch (e) {
    console.error("faucet failed:", e instanceof Error ? e.message : String(e));
    return json({ error: "Couldn't send starting funds. Try again shortly." }, 502);
  }
}

// GET is wired up too so the handler's own 405 answers it, rather than Vercel returning a
// bare 405 that says nothing about the endpoint being alive.
export const GET = handler;
export const POST = handler;
