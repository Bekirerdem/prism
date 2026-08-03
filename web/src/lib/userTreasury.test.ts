import { describe, it, expect } from "vitest";
import { StrKey } from "@stellar/stellar-sdk";
import { assembleSource, isValidContractId, readLifecycle, toStroops, XLM_SAC } from "./userTreasury";
import type { Client } from "./treasuryClient";
import type { TxExecutor } from "./executor";

const executor = (address: string, kind: TxExecutor["kind"]): TxExecutor => ({
  address,
  kind,
  signer: { signTransaction: () => Promise.reject(new Error("unused")) },
  submit: () => Promise.resolve({}),
});

const WALLET = "GDPKXL6CNHUXBV4PM54CPTRZNQRYVTIMO4YGBW3M2MNSCMQ7TTNINXP6";

describe("assembleSource", () => {
  it("assembles a wallet session against the wallet's own account", () => {
    expect(assembleSource(executor(WALLET, "wallet"))).toBe(WALLET);
  });

  it("never assembles against a contract address for a passkey session", () => {
    // The regression this guards: a smart wallet's C… address reached Account() and threw
    // "invalid version byte. expected 48, got 16" before the user could create a treasury.
    const source = assembleSource(executor(XLM_SAC, "passkey"));
    expect(StrKey.isValidContract(source)).toBe(false);
    expect(StrKey.isValidEd25519PublicKey(source)).toBe(true);
  });
});

describe("isValidContractId", () => {
  it("accepts a real contract id", () => {
    expect(isValidContractId(XLM_SAC)).toBe(true);
  });

  it("rejects wallet addresses, truncated ids, and junk", () => {
    expect(isValidContractId("GDPKXL6CNHUXBV4PM54CPTRZNQRYVTIMO4YGBW3M2MNSCMQ7TTNINXP6")).toBe(false);
    expect(isValidContractId(XLM_SAC.slice(0, 30))).toBe(false);
    expect(isValidContractId("not-a-contract")).toBe(false);
    expect(isValidContractId("")).toBe(false);
  });
});

describe("toStroops", () => {
  it("converts whole XLM to 7-decimal stroops", () => {
    expect(toStroops(1)).toBe(10_000_000n);
    expect(toStroops(50)).toBe(500_000_000n);
  });

  it("handles fractional XLM without float drift", () => {
    expect(toStroops(1.5)).toBe(15_000_000n);
    expect(toStroops(0.1)).toBe(1_000_000n);
    expect(toStroops(0.0000001)).toBe(1n);
  });

  it("returns 0n for zero", () => {
    expect(toStroops(0)).toBe(0n);
  });

  it("rejects negative or non-finite amounts", () => {
    expect(() => toStroops(-1)).toThrow();
    expect(() => toStroops(NaN)).toThrow();
    expect(() => toStroops(Infinity)).toThrow();
  });
});

describe("readLifecycle", () => {
  it("returns the pause flag and session from a v3 treasury", async () => {
    const fake = {
      is_paused: async () => ({ result: true }),
      get_session: async () => ({ result: undefined }),
    } as unknown as Client;
    expect(await readLifecycle({ client: fake, submit: async () => ({}) })).toEqual({ paused: true, session: null });
  });

  it("returns null on a pre-M2 treasury (probe failure = legacy signal)", async () => {
    const legacyTreasury = {
      is_paused: async () => {
        throw new Error("HostError: Error(WasmVm, MissingValue)"); // fn not in the old wasm
      },
      get_session: async () => {
        throw new Error("HostError: Error(WasmVm, MissingValue)");
      },
    } as unknown as Client;
    expect(await readLifecycle({ client: legacyTreasury, submit: async () => ({}) })).toBeNull();
  });
});
