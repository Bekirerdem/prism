// Thin app-facing layer over the generated treasury client.
// Reads state via simulation and lets the autonomous agent sign + send payments.

import { Keypair } from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";
import { Client } from "./treasuryClient";
import { contractErr, errText } from "./wallet-errors";
import {
  AGENT_PK,
  AGENT_SECRET,
  NETWORK_PASSPHRASE,
  RPC_URL,
  TREASURY_ID,
} from "../config";

const agentKp = Keypair.fromSecret(AGENT_SECRET);
const signer = basicNodeSigner(agentKp, NETWORK_PASSPHRASE);

const treasury = new Client({
  contractId: TREASURY_ID,
  networkPassphrase: NETWORK_PASSPHRASE,
  rpcUrl: RPC_URL,
  publicKey: AGENT_PK,
  signTransaction: signer.signTransaction,
});

// One shape across the demo (this file) and the per-user product (userTreasury.ts) —
// re-exported here so Dashboard's imports keep working from a single definition.
export type { PayResult, EunomiaState } from "./userTreasury";
import type { PayResult, EunomiaState } from "./userTreasury";

export async function readState(): Promise<EunomiaState> {
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

export async function readTaskSpent(taskId: bigint): Promise<bigint> {
  return (await treasury.task_spent({ task_id: taskId })).result;
}

const MAX_TRIES = 5;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Transient infra / concurrency errors — several judges submitting at the same
 *  instant share one agent account, so a tx can land on a stale sequence. These
 *  are safe to retry after re-fetching the sequence. Exported for tests. */
export function isTransient(msg: string): boolean {
  return /bad[_ ]?seq|sequence|tx_too_late|too[_ ]?late|timeout|timed out|deadline|429|too many|rate limit|50\d\b|service unavailable|temporar|unavailable|connection|network|fetch failed|failed to fetch|econn|reset by peer|try[_ ]?again/i.test(
    msg,
  );
}

export async function agentPay(
  taskId: bigint,
  to: string,
  amount: bigint,
): Promise<PayResult> {
  let lastMsg = "";
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    try {
      // pay() re-fetches the agent account (fresh sequence) on every attempt,
      // so a retry after a concurrent submission picks up the new sequence.
      const tx = await treasury.pay({ task_id: taskId, to, amount });
      const sent = await tx.signAndSend();
      const hash =
        (sent as { sendTransactionResponse?: { hash?: string } })
          .sendTransactionResponse?.hash;
      return { ok: true, hash };
    } catch (e) {
      const msg = errText(e);
      lastMsg = msg;
      const ce = contractErr(msg);
      if (ce) return { ok: false, ...ce }; // real guardrail rejection — surface it, never retry
      if (!isTransient(msg)) {
        // A permanent failure (bad destination, malformed tx, …) — don't invite
        // the user to retry something that will fail forever.
        return { ok: false, errorMessage: msg.slice(0, 120) || "Payment failed." };
      }
      if (attempt < MAX_TRIES - 1) {
        // back off with jitter so concurrent clients de-synchronise, then retry
        await sleep(220 * (attempt + 1) + Math.floor(Math.random() * 400));
        continue;
      }
      return { ok: false, transient: true, errorMessage: "Network busy — please try again" };
    }
  }
  return { ok: false, transient: true, errorMessage: lastMsg.slice(0, 120) || "Network busy" };
}
