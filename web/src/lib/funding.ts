// Testnet funding helpers — a fresh wallet has 0 XLM, so the very first workspace
// action (deploying a treasury) fails with an opaque error. Check the wallet's native
// balance via Horizon and offer friendbot funding when it's empty. Pure functions with
// an injectable fetch, so they're unit-testable.
import { HORIZON_URL } from "../config";

const FRIENDBOT_URL = "https://friendbot.stellar.org";

/** Minimum native balance (XLM) to comfortably deploy, fund, and use a treasury. */
export const MIN_XLM = 20;

/** Native XLM balance of a classic account, or null if the account doesn't exist yet.
 *
 *  Classic accounts only. A smart wallet's XLM lives in the SAC, not in an account record —
 *  asking Horizon for a C-address returns 400, which is what the passkey session was doing on
 *  every load. Callers route those through `getContractXlmBalance`. */
export async function getXlmBalance(
  address: string,
  fetchFn: typeof fetch = fetch,
): Promise<number | null> {
  const res = await fetchFn(`${HORIZON_URL}/accounts/${address}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Horizon error ${res.status} — could not read your wallet balance.`);
  const body = (await res.json()) as { balances?: { asset_type: string; balance: string }[] };
  const native = body.balances?.find((b) => b.asset_type === "native");
  return native ? Number(native.balance) : 0;
}

/** XLM held by a contract account, read from the native SAC by simulation (no signature,
 *  no fee). Returns null when the balance cannot be read at all, matching the classic
 *  helper's "unknown" case. */
export async function getContractXlmBalance(address: string): Promise<number | null> {
  const { Account, BASE_FEE, Contract, TransactionBuilder, rpc, scValToNative, Address } =
    await import("@stellar/stellar-sdk");
  const { NETWORK_PASSPHRASE, RPC_URL, ADMIN } = await import("../config");
  const XLM_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

  try {
    const tx = new TransactionBuilder(new Account(ADMIN, "0"), {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(new Contract(XLM_SAC).call("balance", new Address(address).toScVal()))
      .setTimeout(30)
      .build();

    const sim = await new rpc.Server(RPC_URL).simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) return null;
    return Number(scValToNative(sim.result.retval) as bigint) / 10_000_000;
  } catch {
    return null;
  }
}

/** Ask friendbot to create + fund the account with test XLM. Friendbot only works for
 *  accounts that don't exist on testnet yet — an existing account gets a clear message.
 *
 *  A smart wallet cannot be funded this way at all: friendbot creates classic accounts, and a
 *  classic payment cannot even reach a contract address. Those go to our dispenser instead. */
export async function fundWithFriendbot(
  address: string,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  if (isContractAddress(address)) return dispenseToWallet(address, fetchFn);

  const res = await fetchFn(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(address)}`);
  if (res.ok) return;
  if (res.status === 400) {
    throw new Error(
      "This account is already funded — friendbot only tops up brand-new testnet accounts.",
    );
  }
  throw new Error(`Friendbot error ${res.status} — try again in a moment.`);
}

/** Cheap shape check — a full StrKey validation would pull the SDK into this module, which
 *  is otherwise fetch-only and unit-tests without one. */
function isContractAddress(address: string): boolean {
  return address.startsWith("C") && address.length === 56;
}

/** Starting funds for a smart wallet, sent by the server-side dispenser (one allocation per
 *  wallet). The endpoint owns the policy; this only translates its answers. */
async function dispenseToWallet(wallet: string, fetchFn: typeof fetch): Promise<void> {
  const res = await fetchFn("/api/faucet", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet }),
  });
  if (res.ok) return;

  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 409) {
    throw new Error("This wallet already has its starting test XLM.");
  }
  if (res.status === 429) {
    throw new Error(body.error ?? "The testnet faucet has hit its daily limit. Try again tomorrow.");
  }
  console.error(`[faucet] ${res.status}:`, body.error ?? "(no detail)");
  throw new Error("Couldn't send starting funds. Try again shortly.");
}

/** true when the balance is too low to deploy + fund a treasury. */
export function needsFunding(balance: number | null): boolean {
  return balance === null || balance < MIN_XLM;
}
