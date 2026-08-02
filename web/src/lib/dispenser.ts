// Testnet-only: what to do when a passkey user asks for starting funds.
//
// Why this exists at all: friendbot only funds CLASSIC accounts, and Stellar's classic payment
// operation cannot target a contract address. A passkey user's wallet is a contract account,
// so there is no path for testnet XLM to reach it — the dispenser sends it via a SAC transfer.
// On mainnet this component has no counterpart: real users bring their own funds.
//
// Kept pure (chain access injected) so the policy is testable without a network.

/** Handed to each new smart wallet. Enough to fund a treasury and exercise the limits. */
export const DISPENSE_XLM = 500;

/** Below this the dispenser can no longer serve a full request and must be topped up first. */
export const MIN_DISPENSER_BALANCE = DISPENSE_XLM + 100; // headroom for fees

/** Contract addresses are StrKey `C…`, 56 chars. Accounts (`G…`) are not smart wallets. */
const CONTRACT_ID = /^C[A-Z2-7]{55}$/;

export type DispenseAction =
  | { action: "dispense"; amount: number }
  | { action: "refill-then-dispense"; amount: number }
  | { action: "already-served" }
  | { action: "invalid" };

export interface DispenserDeps {
  /** Whether this wallet has had its one allocation already. */
  alreadyServed: (wallet: string) => Promise<boolean>;
  /** Current XLM balance of the funding account. */
  dispenserBalance: () => Promise<number>;
}

/** Decide, without touching the chain unless the address is worth checking. */
export async function dispenseDecision(
  wallet: string,
  deps: DispenserDeps,
): Promise<DispenseAction> {
  if (!CONTRACT_ID.test(wallet)) return { action: "invalid" };

  if (await deps.alreadyServed(wallet)) return { action: "already-served" };

  const balance = await deps.dispenserBalance();
  return balance < MIN_DISPENSER_BALANCE
    ? { action: "refill-then-dispense", amount: DISPENSE_XLM }
    : { action: "dispense", amount: DISPENSE_XLM };
}
