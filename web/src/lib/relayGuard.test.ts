import { describe, it, expect } from "vitest";
import { isAllowedContract } from "./relayGuard";

// A real testnet contract id, so the shape check is exercised against the genuine article.
const TREASURY = "CBEPVXK6RGYUMHZCJ4H2TQZKGCVWZC5X6LPUZQ6ZOEXTPZ63DZMD4ZE7";
const ALLOW = [TREASURY];

describe("isAllowedContract", () => {
  it("allows a contract on the list", () => {
    expect(isAllowedContract(TREASURY, ALLOW)).toBe(true);
  });

  it("rejects a contract that is not on the list", () => {
    expect(isAllowedContract("CDQ6ZOEXTPZ63DZMD4ZE7BEPVXK6RGYUMHZCJ4H2TQZKGCVWZC5X", ALLOW)).toBe(false);
  });

  it("rejects empty or malformed input rather than passing it through", () => {
    expect(isAllowedContract("", ALLOW)).toBe(false);
    expect(isAllowedContract("not-a-contract", ALLOW)).toBe(false);
    // A G-address is a valid StrKey but not a contract — the relay only ever calls contracts.
    expect(isAllowedContract("GBGHXQXR7BQZMZ3EPWXVMBNVFHXHVZQJPVWQGCTLPXQHRTFHXQXR7BQZ", ALLOW)).toBe(false);
  });

  it("rejects everything when the allowlist is empty — fail closed", () => {
    // A misconfigured deploy (env var missing) must not turn the relay into an open one.
    expect(isAllowedContract(TREASURY, [])).toBe(false);
  });

  it("does not treat a prefix or substring as a match", () => {
    expect(isAllowedContract(TREASURY.slice(0, 55), ALLOW)).toBe(false);
  });
});
