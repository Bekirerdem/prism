import { describe, it, expect, vi } from "vitest";
import { isAllowedContract, isRelayAllowed } from "./relayGuard";

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
    // An account address, not a contract — the relay only ever calls contracts.
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

// User treasuries are deployed per user, so no fixed address list can cover them. What they
// DO share is the wasm they run. The relay therefore admits a call when the contract is either
// one of our fixed contracts (the registry) or runs our treasury wasm.
const REGISTRY = "CBEPVXK6RGYUMHZCJ4H2TQZKGCVWZC5X6LPUZQ6ZOEXTPZ63DZMD4ZE7";
const USER_TREASURY = "CAYWNXHANRY5GSJAZOR4YTKBKNOKTCITE52ZRKDKCAWLDTYWFFVFSPAZ";
const TREASURY_WASM = "475cfbe2ca79d7977c8e4d29438ae70b9d95a12cb2bfcd9fed4e4f7a26d798b2";

const guard = (readWasmHash: (id: string) => Promise<string | null>) => ({
  contracts: [REGISTRY],
  wasmHashes: [TREASURY_WASM],
  readWasmHash,
});

describe("isRelayAllowed", () => {
  it("admits a fixed contract without asking the chain", async () => {
    const readWasmHash = vi.fn();
    await expect(isRelayAllowed(REGISTRY, guard(readWasmHash))).resolves.toBe(true);
    expect(readWasmHash).not.toHaveBeenCalled();
  });

  it("admits an unknown contract that runs our treasury wasm", async () => {
    const readWasmHash = vi.fn().mockResolvedValue(TREASURY_WASM);
    await expect(isRelayAllowed(USER_TREASURY, guard(readWasmHash))).resolves.toBe(true);
    expect(readWasmHash).toHaveBeenCalledWith(USER_TREASURY);
  });

  it("rejects a contract running someone else's wasm", async () => {
    const readWasmHash = vi.fn().mockResolvedValue("dead".repeat(16));
    await expect(isRelayAllowed(USER_TREASURY, guard(readWasmHash))).resolves.toBe(false);
  });

  it("rejects when the contract cannot be found on chain", async () => {
    const readWasmHash = vi.fn().mockResolvedValue(null);
    await expect(isRelayAllowed(USER_TREASURY, guard(readWasmHash))).resolves.toBe(false);
  });

  it("rejects a malformed id without touching the chain", async () => {
    const readWasmHash = vi.fn();
    await expect(isRelayAllowed("not-a-contract", guard(readWasmHash))).resolves.toBe(false);
    expect(readWasmHash).not.toHaveBeenCalled();
  });

  it("fails closed when the chain lookup throws", async () => {
    // An RPC outage must not turn the relay into an open one.
    const readWasmHash = vi.fn().mockRejectedValue(new Error("rpc down"));
    await expect(isRelayAllowed(USER_TREASURY, guard(readWasmHash))).resolves.toBe(false);
  });

  it("is case-insensitive about the wasm hash hex", async () => {
    const readWasmHash = vi.fn().mockResolvedValue(TREASURY_WASM.toUpperCase());
    await expect(isRelayAllowed(USER_TREASURY, guard(readWasmHash))).resolves.toBe(true);
  });
});
