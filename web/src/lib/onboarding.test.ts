import { describe, expect, it } from "vitest";
import { setupProgress, type SetupInputs } from "./onboarding";

const base: SetupInputs = {
  connected: false,
  hasTreasury: false,
  balance: null,
  payeeCount: null,
  hasPaid: false,
};

describe("setupProgress", () => {
  it("starts a fresh visitor at connect", () => {
    const p = setupProgress(base);
    expect(p.next).toBe("connect");
    expect(p.complete).toBe(false);
    expect(p.steps.map((s) => s.step)).toEqual(["connect", "deploy", "fund", "whitelist", "pay"]);
  });

  it("moves to deploy once connected", () => {
    expect(setupProgress({ ...base, connected: true }).next).toBe("deploy");
  });

  it("does NOT count fund as done while the balance is still unknown", () => {
    const p = setupProgress({ ...base, connected: true, hasTreasury: true, balance: null });
    expect(p.next).toBe("fund");
  });

  it("moves to whitelist when funded but payee-less", () => {
    const p = setupProgress({ ...base, connected: true, hasTreasury: true, balance: 100n, payeeCount: 0 });
    expect(p.next).toBe("whitelist");
  });

  it("moves to pay with a payee whitelisted", () => {
    const p = setupProgress({
      ...base,
      connected: true,
      hasTreasury: true,
      balance: 100n,
      payeeCount: 1,
    });
    expect(p.next).toBe("pay");
  });

  it("completes when everything is done", () => {
    const p = setupProgress({
      connected: true,
      hasTreasury: true,
      balance: 1n,
      payeeCount: 2,
      hasPaid: true,
    });
    expect(p.complete).toBe(true);
    expect(p.next).toBeNull();
    expect(p.steps.every((s) => s.done)).toBe(true);
  });

  it("points at the FIRST unfinished step even when later ones are done", () => {
    // whitelisted before funding — next is still fund
    const p = setupProgress({ ...base, connected: true, hasTreasury: true, balance: 0n, payeeCount: 3 });
    expect(p.next).toBe("fund");
  });
});
