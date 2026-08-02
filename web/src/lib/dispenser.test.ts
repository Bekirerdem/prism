import { describe, it, expect, vi } from "vitest";
import { dispenseDecision, DISPENSE_XLM, MIN_DISPENSER_BALANCE } from "./dispenser";

const WALLET = "CAYWNXHANRY5GSJAZOR4YTKBKNOKTCITE52ZRKDKCAWLDTYWFFVFSPAZ";

describe("dispenseDecision", () => {
  it("dispenses to a smart wallet that has never been served", async () => {
    const d = await dispenseDecision(WALLET, {
      alreadyServed: vi.fn().mockResolvedValue(false),
      dispenserBalance: vi.fn().mockResolvedValue(10_000),
    });
    expect(d).toEqual({ action: "dispense", amount: DISPENSE_XLM });
  });

  it("refuses a second dispense to the same address", async () => {
    // One per address: the quota exists to onboard users, not to be farmed.
    const d = await dispenseDecision(WALLET, {
      alreadyServed: vi.fn().mockResolvedValue(true),
      dispenserBalance: vi.fn().mockResolvedValue(10_000),
    });
    expect(d).toEqual({ action: "already-served" });
  });

  it("asks for a top-up before dispensing when the dispenser is running low", async () => {
    // Friendbot cannot refill an existing account, so the fix is a fresh funded account
    // whose balance is swept in — decided here, performed by the caller.
    const d = await dispenseDecision(WALLET, {
      alreadyServed: vi.fn().mockResolvedValue(false),
      dispenserBalance: vi.fn().mockResolvedValue(MIN_DISPENSER_BALANCE - 1),
    });
    expect(d).toEqual({ action: "refill-then-dispense", amount: DISPENSE_XLM });
  });

  it("rejects anything that is not a contract address", async () => {
    const deps = {
      alreadyServed: vi.fn().mockResolvedValue(false),
      dispenserBalance: vi.fn().mockResolvedValue(10_000),
    };
    await expect(dispenseDecision("GBGHXQXR7BQZMZ3EPWXVMBNVFHXHVZQJPVWQGCTLPXQHRTFHXQXR7BQZ", deps)).resolves.toEqual({
      action: "invalid",
    });
    await expect(dispenseDecision("", deps)).resolves.toEqual({ action: "invalid" });
    // A bad address must not cost us a chain lookup.
    expect(deps.alreadyServed).not.toHaveBeenCalled();
  });
});
