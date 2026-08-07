// Bounded x402 over HTTP: the real 402 handshake (fetch → 402 → pay → retry)
// through the official @x402 client, with the treasury gate wired into the
// client's PaymentPolicy seam. Payment options that violate the policy are
// filtered out before the client signs anything, so an over-limit or
// wrong-payee 402 fails the request instead of producing a payment.
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import { makeBoundedPolicy, type GateDecision } from "./policy.js";
import type { TreasuryPolicy } from "./types.js";

export interface BoundedFetchOptions {
  /** snapshot of the treasury's spend policy (the off-chain mirror of the on-chain gate) */
  policy: TreasuryPolicy;
  /** Ed25519 secret of the agent's SPENDING account — the allowance account the
   *  treasury funds with bounded `pay()` top-ups, never the treasury itself */
  agentSecret: string;
  /** CAIP-2 network the signer defaults to */
  network?: "stellar:testnet" | "stellar:pubnet";
  /** called for every payment option the gate examines (refusals stay visible) */
  onDecision?: GateDecision;
  /** custom Soroban RPC endpoint (mainnet requires one) */
  rpcUrl?: string;
  /** injected for tests; defaults to globalThis.fetch */
  fetchImpl?: typeof fetch;
}

/**
 * Build a fetch that can pay for x402 resources, but only within the treasury
 * policy. Non-402 responses pass through untouched.
 */
export function makeBoundedFetch(opts: BoundedFetchOptions): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  const signer = createEd25519Signer(opts.agentSecret, opts.network ?? "stellar:testnet");
  const scheme = opts.rpcUrl
    ? new ExactStellarScheme(signer, { url: opts.rpcUrl })
    : new ExactStellarScheme(signer);
  const client = new x402Client()
    .register("stellar:*", scheme)
    .registerPolicy(makeBoundedPolicy(opts.policy, opts.onDecision));
  return wrapFetchWithPayment(opts.fetchImpl ?? globalThis.fetch, client);
}
