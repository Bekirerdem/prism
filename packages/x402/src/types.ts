// x402 v2 "exact" scheme payment requirements on Stellar (the JSON a server returns
// with HTTP 402), trimmed to the fields the bounded gate needs. Stellar supports v2
// only — see coinbase/x402 specs/schemes/exact/scheme_exact_stellar.md.
export interface PaymentRequirements {
  scheme: string; // "exact" — the only scheme defined for Stellar
  network: `${string}:${string}`; // CAIP-2, e.g. "stellar:testnet" / "stellar:pubnet"
  /** amount in atomic units (asset's own decimals), as a decimal string */
  amount: string;
  asset: string; // SEP-41 contract id of the payment asset
  payTo: string; // recipient address
  /** how long the client's signed authorization may stay valid, in seconds */
  maxTimeoutSeconds: number;
  /** scheme-specific fields; on Stellar carries `areFeesSponsored` (facilitator
   *  sponsors fees — currently always true). Open-ended to match @x402/core. */
  extra: Record<string, unknown>;
}

/** A snapshot of the treasury's spend policy, read off-chain to pre-flight a payment
 *  before signing/submitting (the on-chain treasury is the final enforcement). */
export interface TreasuryPolicy {
  perTaskLimit: bigint;
  dailyLimit: bigint;
  daySpent: bigint;
  token: string; // SEP-41 id of the asset the treasury spends
  /** whitelist OR reputation-gate result for a payee (mirrors the on-chain gate) */
  isAllowedPayee: (payee: string) => boolean;
}

export interface GateResult {
  allowed: boolean;
  amount: bigint;
  reason?: string;
}
