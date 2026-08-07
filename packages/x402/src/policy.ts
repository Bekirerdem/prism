import { gateX402 } from "./gate.js";
import type { GateResult, PaymentRequirements, TreasuryPolicy } from "./types.js";

/** Called for every payment option the gate examines — surfaces refusal reasons
 *  instead of silently filtering them away. */
export type GateDecision = (req: PaymentRequirements, gate: GateResult) => void;

/**
 * Adapt the bounded gate to the x402 client's PaymentPolicy seam
 * (`x402Client.registerPolicy`): payment options that violate the treasury
 * policy are removed BEFORE the client ever signs a payment, so an over-limit
 * or wrong-payee 402 can't produce a signature at all. Structurally compatible
 * with @x402/core's `PaymentPolicy` — no dependency needed here.
 */
export function makeBoundedPolicy(policy: TreasuryPolicy, onDecision?: GateDecision) {
  return (_x402Version: number, reqs: PaymentRequirements[]): PaymentRequirements[] =>
    reqs.filter((req) => {
      const gate = gateX402(req, policy);
      onDecision?.(req, gate);
      return gate.allowed;
    });
}
