export * from "./types.js";
export { gateX402 } from "./gate.js";
export { makeBoundedPolicy, type GateDecision } from "./policy.js";
export { makeBoundedFetch, type BoundedFetchOptions } from "./boundedFetch.js";
export { buildPayArgs, makeTreasurySettle } from "./settle.js";

import { gateX402 } from "./gate.js";
import type { GateResult, PaymentRequirements, TreasuryPolicy } from "./types.js";

/** Settles a payment through the bounded treasury (invokes the v2 treasury's `pay`
 *  via the agent's Soroban auth-entry signature) and returns the settlement tx hash.
 *  Provided by the caller so this package stays transport-agnostic + testable. */
export type SettleFn = (payTo: string, amount: bigint) => Promise<string>;

export interface BoundedPayResult {
  gate: GateResult;
  txHash?: string;
}

/**
 * Bounded x402 payment: gate the request against the treasury policy, then settle
 * through the treasury ONLY if allowed. A denied request never reaches `settle`, so
 * the agent can't be tricked into an over-limit / wrong-payee x402 payment.
 */
export async function boundedPay(
  req: PaymentRequirements,
  policy: TreasuryPolicy,
  settle: SettleFn,
): Promise<BoundedPayResult> {
  const gate = gateX402(req, policy);
  if (!gate.allowed) {
    return { gate };
  }
  const txHash = await settle(req.payTo, gate.amount);
  return { gate, txHash };
}
