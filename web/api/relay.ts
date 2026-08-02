// Vercel serverless function: the only place the OZ Channels API key exists.
//
// It carries NO fee-payer secret and funds no account — OpenZeppelin pays the fees. What it
// does hold is a fee quota, and in an open-source repo this endpoint's URL is public, so every
// request is admitted only after the server itself decodes what the transaction actually does.
// A caller-supplied "this goes to contract X" claim is never trusted.
import { ChannelsClient } from "@openzeppelin/relayer-plugin-channels";
import { rpc, xdr } from "@stellar/stellar-sdk";
import { classifyHostFunction } from "../src/lib/hostFunction";
import { isRelayAllowed } from "../src/lib/relayGuard";

// Invisible characters smuggled into an env value have bitten this project twice (a BOM in
// the Supabase key, a BOM+CRLF in the WalletConnect id) — both times the symptom was a silent
// failure far from the cause. Strip anything non-printable before use; .trim() alone misses
// zero-width characters.
const clean = (v: string | undefined): string => (v ?? "").replace(/[^\x20-\x7E]/g, "").trim();

const csv = (v: string | undefined): string[] =>
  clean(v).split(",").map((s) => s.trim()).filter(Boolean);

const ALLOWED_CONTRACTS = csv(process.env.RELAY_ALLOWED_CONTRACTS);
const ALLOWED_WASM = csv(process.env.RELAY_ALLOWED_WASM);
const RPC_URL = process.env.RELAY_RPC_URL ?? "https://soroban-testnet.stellar.org";
const CHANNELS_URL = process.env.OZ_CHANNELS_BASE_URL ?? "https://channels.openzeppelin.com/testnet";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** The wasm a deployed contract runs, or null when it isn't on chain. */
async function readWasmHash(contractId: string): Promise<string | null> {
  const server = new rpc.Server(RPC_URL);
  const entry = await server.getContractData(
    contractId,
    xdr.ScVal.scvLedgerKeyContractInstance(),
    rpc.Durability.Persistent,
  );
  const executable = entry.val.contractData().val().instance().executable();
  if (executable.switch().name !== "contractExecutableWasm") return null;
  return executable.wasmHash().toString("hex");
}

/** Decide whether this call may spend our fee quota. Fails closed. */
async function admit(func: string): Promise<boolean> {
  const call = classifyHostFunction(func);
  if (call.kind === "invoke") {
    return isRelayAllowed(call.contractId, {
      contracts: ALLOWED_CONTRACTS,
      wasmHashes: ALLOWED_WASM,
      readWasmHash,
    });
  }
  if (call.kind === "deploy") {
    const seen = call.wasmHash.toLowerCase();
    return ALLOWED_WASM.some((h) => h.toLowerCase() === seen);
  }
  return false; // raw wasm uploads and anything unrecognised
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = clean(process.env.OZ_CHANNELS_API_KEY);
  if (!apiKey) return json({ error: "Relay is not configured." }, 503);

  let body: { func?: unknown; auth?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "Malformed request." }, 400);
  }

  const { func, auth } = body;
  if (typeof func !== "string" || !Array.isArray(auth) || !auth.every((a) => typeof a === "string")) {
    return json({ error: "Malformed request." }, 400);
  }

  if (!(await admit(func))) return json({ error: "Not allowed." }, 403);

  try {
    const client = new ChannelsClient({ baseUrl: CHANNELS_URL, apiKey });
    const result = await client.submitSorobanTransaction({ func, auth: auth as string[] });
    return json({ hash: result.hash, status: result.status }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("FEE_LIMIT_EXCEEDED")) return json({ error: "FEE_LIMIT_EXCEEDED" }, 429);
    console.error("relay failed:", msg);
    return json({ error: "Relay failed." }, 502);
  }
}
