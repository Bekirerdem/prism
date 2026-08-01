// Per-user treasury operations: deploy a fresh treasury owned by the connected wallet,
// fund it, govern its policy, and spend from it — all signed by the user's wallet. This is
// the per-user analogue of prism.ts (which drives the single embedded-agent demo treasury).
import {
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { Client, type Session } from "./treasuryClient";
import { contractErr, errText } from "./wallet-errors";
import type { ContractSigner } from "./walletSigner";
import { NETWORK_PASSPHRASE, RPC_URL } from "../config";

// Native XLM SAC on testnet — the token each user treasury holds and spends.
export const XLM_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
// Treasury WASM already installed on-chain — deploy just instantiates a new contract from it.
// v3.2 (audit C3 closure: instance-storage TTL auto-extended on every mutation, so a
// low-activity treasury can't be archived; + per-payment-limit doc clarity), installed 2026-07-09:
// https://stellar.expert/explorer/testnet/tx/d97fc74fe0c2f750b27669690c9b7c58caffe4532501c7b98ed63afd5cbe7ab1
export const TREASURY_WASM_HASH =
  "475cfbe2ca79d7977c8e4d29438ae70b9d95a12cb2bfcd9fed4e4f7a26d798b2";

const XLM_UNIT = 10_000_000;

/** Whether a pasted string is a well-formed contract id (C…, 56 chars, valid checksum). */
export function isValidContractId(id: string): boolean {
  return StrKey.isValidContract(id);
}

/** XLM (float) -> i128 stroops (7 decimals), rounded to avoid float drift. */
export function toStroops(xlm: number): bigint {
  if (!Number.isFinite(xlm) || xlm < 0) {
    throw new Error("Amount must be a non-negative number.");
  }
  return BigInt(Math.round(xlm * XLM_UNIT));
}

export interface EunomiaState {
  balance: bigint;
  daySpent: bigint;
  dailyLimit: bigint;
  perTaskLimit: bigint;
  admin: string;
  agent: string;
  token: string;
}

export interface PayResult {
  ok: boolean;
  hash?: string;
  errorCode?: number;
  errorMessage?: string;
  /** true = an infra/concurrency hiccup (stale sequence, RPC busy), NOT a contract
   *  guardrail rejection — safe to retry. Only the shared-agent demo path sets it. */
  transient?: boolean;
}

/** A treasury Client bound to a runtime contract id + the connected wallet as signer. */
export function makeTreasury(contractId: string, address: string, signer: ContractSigner): Client {
  return new Client({
    contractId,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    publicKey: address,
    signTransaction: signer.signTransaction,
  });
}

/** Deploy a fresh treasury owned by `address` (admin = agent = the wallet). Returns its id. */
export async function deployTreasury(
  address: string,
  signer: ContractSigner,
  dailyXlm: number,
  perTaskXlm: number,
): Promise<string> {
  const tx = await Client.deploy(
    {
      admin: address,
      agent: address,
      token: XLM_SAC,
      daily_limit: toStroops(dailyXlm),
      per_task_limit: toStroops(perTaskXlm),
    },
    {
      wasmHash: TREASURY_WASM_HASH,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: RPC_URL,
      publicKey: address,
      signTransaction: signer.signTransaction,
    },
  );
  const { result } = await tx.signAndSend();
  return result.options.contractId;
}

/** Fund a treasury by transferring native XLM from the wallet into the treasury contract
 *  (a SAC transfer; the `from` auth is the tx source, so the wallet signature covers it). */
export async function fundTreasury(
  contractId: string,
  address: string,
  signer: ContractSigner,
  amountXlm: number,
): Promise<string> {
  const server = new rpc.Server(RPC_URL);
  const account = await server.getAccount(address);
  const sac = new Contract(XLM_SAC);
  const op = sac.call(
    "transfer",
    new Address(address).toScVal(),
    new Address(contractId).toScVal(),
    nativeToScVal(toStroops(amountXlm), { type: "i128" }),
  );
  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(180)
    .build();
  const prepared = await server.prepareTransaction(built);
  const { signedTxXdr } = await signer.signTransaction(prepared.toXDR());
  const sent = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE),
  );
  return sent.hash;
}

export async function readState(treasury: Client): Promise<EunomiaState> {
  const [bal, cfg, day] = await Promise.all([
    treasury.balance(),
    treasury.get_config(),
    treasury.day_spent(),
  ]);
  const c = cfg.result;
  return {
    balance: bal.result,
    daySpent: day.result,
    dailyLimit: c.daily_limit,
    perTaskLimit: c.per_task_limit,
    admin: c.admin,
    agent: c.agent,
    token: c.token,
  };
}

/** Read-only whitelist probe (simulation, no signature) — the chain-truth behind the
 *  "verified" badge on the derived payee list. */
export async function isPayee(treasury: Client, payee: string): Promise<boolean> {
  const tx = await treasury.is_payee({ payee });
  return tx.result;
}

export async function addPayee(treasury: Client, payee: string): Promise<void> {
  const tx = await treasury.add_payee({ payee });
  await tx.signAndSend();
}

export async function removePayee(treasury: Client, payee: string): Promise<void> {
  const tx = await treasury.remove_payee({ payee });
  await tx.signAndSend();
}

/** Build → sign → send a contract tx, mapping on-chain guardrail rejections
 *  to friendly messages. Shared by every state-changing treasury call. */
async function sendTx(
  build: () => Promise<{ signAndSend: () => Promise<unknown> }>,
  failMsg: string,
): Promise<PayResult> {
  try {
    const tx = await build();
    const sent = await tx.signAndSend();
    const hash = (sent as { sendTransactionResponse?: { hash?: string } }).sendTransactionResponse
      ?.hash;
    return { ok: true, hash };
  } catch (e) {
    const msg = errText(e);
    const ce = contractErr(msg);
    if (ce) return { ok: false, ...ce };
    return { ok: false, errorMessage: msg.slice(0, 160) || failMsg };
  }
}

/** Spend from the treasury. The contract enforces the policy and rejects violations
 *  on-chain — those rejections are the product working, surfaced as messages. */
export async function pay(
  treasury: Client,
  taskId: bigint,
  to: string,
  amountXlm: number,
): Promise<PayResult> {
  return sendTx(
    () => treasury.pay({ task_id: taskId, to, amount: toStroops(amountXlm) }),
    "Payment failed.",
  );
}

// ---- M2 lifecycle ---------------------------------------------------------------

export interface Lifecycle {
  paused: boolean;
  session: Session | null;
}

/** The v3 lifecycle state (pause flag + agent session). Returns null on a pre-M2
 *  treasury — callers treat null as "legacy: hide the session/lifecycle sections". */
export async function readLifecycle(treasury: Client): Promise<Lifecycle | null> {
  try {
    const [paused, session] = await Promise.all([treasury.is_paused(), treasury.get_session()]);
    return { paused: paused.result, session: session.result ?? null };
  } catch {
    return null;
  }
}

/** Freeze/unfreeze spending (owner-signed). Exit paths keep working while paused. */
export async function setPaused(treasury: Client, paused: boolean): Promise<PayResult> {
  return sendTx(() => treasury.set_paused({ paused }), "Pause toggle failed.");
}

/** Owner reclaims free (unlocked) funds — exempt from pause, limits, and the whitelist. */
export async function adminWithdraw(
  treasury: Client,
  to: string,
  amountXlm: number,
): Promise<PayResult> {
  return sendTx(
    () => treasury.admin_withdraw({ to, amount: toStroops(amountXlm) }),
    "Withdraw failed.",
  );
}

/** Update the spending limits, effective immediately (owner-signed). */
export async function setLimits(
  treasury: Client,
  dailyXlm: number,
  perTaskXlm: number,
): Promise<PayResult> {
  return sendTx(
    () =>
      treasury.set_limits({
        daily_limit: toStroops(dailyXlm),
        per_task_limit: toStroops(perTaskXlm),
      }),
    "Limit update failed.",
  );
}

/** Register a session agent (owner-signed). While active it is the treasury's
 *  ONLY spender — time-bound, spend-capped, instantly revocable. */
export async function setSession(
  treasury: Client,
  agent: string,
  validUntil: bigint,
  capXlm: number,
): Promise<PayResult> {
  return sendTx(
    () => treasury.set_session({ agent, valid_until: validUntil, limit: toStroops(capXlm) }),
    "Session start failed.",
  );
}

/** Instantly revoke the session (owner-signed) — spending falls back to the wallet. */
export async function revokeSession(treasury: Client): Promise<PayResult> {
  return sendTx(() => treasury.revoke_session(), "Session revoke failed.");
}
