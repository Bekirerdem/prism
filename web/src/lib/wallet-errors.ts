// Wallet error classification — pure functions, so they're unit-testable. Map raw
// wallet/SDK errors into the three surfaced error types: wallet not installed,
// request rejected, and insufficient balance.

export function errText(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return typeof e === "string" ? e : "";
}

/** connect: wallet not installed (type 1) or request rejected (type 2). */
export function connectErr(e: unknown): string {
  const m = errText(e).toLowerCase();
  if (m.includes("not available") || m.includes("not installed") || m.includes("install")) {
    return "That wallet isn't installed — pick another option.";
  }
  if (
    m.includes("reject") || m.includes("denied") || m.includes("declin") ||
    m.includes("close") || m.includes("cancel")
  ) {
    return "Connection cancelled.";
  }
  return errText(e) || "Couldn't connect a wallet.";
}

/** The user-facing text for a wallet session the wallet no longer honours. */
export const STALE_SESSION_MSG =
  "Wallet connection expired — reconnect your wallet and try again.";

/** A WalletConnect session the wallet dropped (deleted, expired or never paired). The app
 *  keeps signing against a topic that no longer exists, so nothing ever opens on the phone.
 *  Detected here so callers can clear the session instead of showing the raw core error. */
export function isStaleSessionError(e: unknown): boolean {
  const m = errText(e).toLowerCase();
  if (!m.includes("session")) return false;
  return (
    m.includes("recently deleted") ||
    m.includes("no matching key") ||
    m.includes("missing or invalid") ||
    m.includes("expired")
  );
}

/** send: insufficient balance (type 3) or signature rejected (type 2). */
export function sendErr(e: unknown): string {
  if (isStaleSessionError(e)) return STALE_SESSION_MSG;
  const codes = (e as {
    response?: { data?: { extras?: { result_codes?: { operations?: string[]; transaction?: string } } } };
  })?.response?.data?.extras?.result_codes;
  const opCodes = codes?.operations?.join(", ") || codes?.transaction || "";
  if (opCodes.includes("underfunded") || opCodes.toLowerCase().includes("insufficient")) {
    return "Insufficient balance for this payment.";
  }
  const m = errText(e).toLowerCase();
  if (m.includes("account not found") || m.includes("account does not exist")) {
    return "Your wallet has no XLM on testnet yet — use the funding box above to get free testnet XLM first.";
  }
  if (m.includes("underfunded") || m.includes("insufficient balance")) {
    return "Insufficient balance for this payment.";
  }
  if (m.includes("reject") || m.includes("denied") || m.includes("declin") || m.includes("cancel")) {
    return "Signature rejected in your wallet.";
  }
  return opCodes || errText(e) || "Transaction failed.";
}

/** On-chain policy rejections (`Error(Contract, #N)`) → human-readable messages.
 *  A rejection is the product working — these read as guardrails, not failures. */
export const CONTRACT_ERRORS: Record<number, string> = {
  1: "Amount must be greater than zero.",
  2: "Payee isn't approved — not on the whitelist.",
  3: "Over the per-task limit — the payment never left the treasury.",
  4: "Over today's daily limit — the payment never left the treasury.",
  5: "Payee's reputation score is below the required threshold.",
  6: "Not enough free balance — funds are locked in open escrows.",
  7: "Escrow not found — it may already be released or refunded.",
  8: "Escrow deadline hasn't passed yet — refund isn't available.",
  9: "Treasury is paused — spending is temporarily frozen by the owner.",
  10: "Over the agent session's spending cap — the payment never left the treasury.",
  11: "Invalid limits — both must be positive and per-payment can't exceed daily.",
  12: "Escrow deadline must be in the future.",
};

/** Parse a contract guardrail rejection out of a raw error message. Returns null
 *  when the failure isn't a contract error, so callers' retry logic stays intact. */
export function contractErr(msg: string): { errorCode: number; errorMessage: string } | null {
  const m = msg.match(/Error\(Contract,\s*#?(\d+)\)/);
  if (!m) return null;
  const code = Number(m[1]);
  return { errorCode: code, errorMessage: CONTRACT_ERRORS[code] ?? `Contract error #${code}` };
}
