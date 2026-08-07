import { describe, it, expect, vi } from "vitest";
import { dispenseDecision, DAILY_DISPENSE_CAP, DISPENSE_XLM, MIN_DISPENSER_BALANCE } from "./dispenser";

const WALLET = "CAYWNXHANRY5GSJAZOR4YTKBKNOKTCITE52ZRKDKCAWLDTYWFFVFSPAZ";

/** Defaults describe a healthy dispenser with a quiet day behind it. */
const deps = (over: Partial<Parameters<typeof dispenseDecision>[1]> = {}) => ({
  alreadyServed: vi.fn().mockResolvedValue(false),
  dispenserBalance: vi.fn().mockResolvedValue(10_000),
  servedToday: vi.fn().mockResolvedValue(0),
  ...over,
});

describe("dispenseDecision", () => {
  it("dispenses to a smart wallet that has never been served", async () => {
    const d = await dispenseDecision(WALLET, deps());
    expect(d).toEqual({ action: "dispense", amount: DISPENSE_XLM });
  });

  it("refuses a second dispense to the same address", async () => {
    // One per address: the quota exists to onboard users, not to be farmed.
    const d = await dispenseDecision(WALLET, deps({ alreadyServed: vi.fn().mockResolvedValue(true) }));
    expect(d).toEqual({ action: "already-served" });
  });

  it("asks for a top-up before dispensing when the dispenser is running low", async () => {
    // Friendbot cannot refill an existing account, so the fix is a fresh funded account
    // whose balance is swept in — decided here, performed by the caller.
    const d = await dispenseDecision(
      WALLET,
      deps({ dispenserBalance: vi.fn().mockResolvedValue(MIN_DISPENSER_BALANCE - 1) }),
    );
    expect(d).toEqual({ action: "refill-then-dispense", amount: DISPENSE_XLM });
  });

  it("stops dispensing once the day's cap is reached", async () => {
    // Per-wallet limits alone bound nothing: fresh smart wallets are free to create, so
    // without a daily ceiling one script can drain the dispenser and flood the metrics.
    const d = await dispenseDecision(WALLET, deps({ servedToday: vi.fn().mockResolvedValue(DAILY_DISPENSE_CAP) }));
    expect(d).toEqual({ action: "daily-cap-reached" });
  });

  it("still serves the last allocation below the cap", async () => {
    const d = await dispenseDecision(WALLET, deps({ servedToday: vi.fn().mockResolvedValue(DAILY_DISPENSE_CAP - 1) }));
    expect(d).toEqual({ action: "dispense", amount: DISPENSE_XLM });
  });

  it("rejects anything that is not a contract address", async () => {
    const d = deps();
    await expect(dispenseDecision("GBGHXQXR7BQZMZ3EPWXVMBNVFHXHVZQJPVWQGCTLPXQHRTFHXQXR7BQZ", d)).resolves.toEqual({
      action: "invalid",
    });
    await expect(dispenseDecision("", d)).resolves.toEqual({ action: "invalid" });
    // A bad address must not cost us a chain lookup.
    expect(d.alreadyServed).not.toHaveBeenCalled();
  });
});
