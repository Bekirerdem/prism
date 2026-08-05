import { describe, it, expect, vi } from "vitest";
import { Address, scValToNative } from "@stellar/stellar-sdk";
import {
  deployTreasury,
  makeTreasury,
  isOwnedBy,
  isValidContractId,
  readLifecycle,
  toStroops,
  TREASURY_WASM_HASH,
  XLM_SAC,
  type EunomiaState,
} from "./userTreasury";
import type { Client } from "./treasuryClient";
import type { TxExecutor } from "./executor";

const SMART_WALLET = "CAYWNXHANRY5GSJAZOR4YTKBKNOKTCITE52ZRKDKCAWLDTYWFFVFSPAZ";
const DEPLOYED = "CCU3NHMJGYNFNGWH5IZ3RTE7PPETD7QVVWK2H6DIQCFJKGXGLKKRHWO7";

describe("makeTreasury", () => {
  const executor = (address: string, kind: "wallet" | "passkey") =>
    ({
      address,
      kind,
      signer: { signTransaction: vi.fn() },
      submit: vi.fn(),
    }) as unknown as TxExecutor;

  it("does not hand a smart wallet address to the contract client", () => {
    // The regression: the client resolves publicKey with getAccount(), and a C-address comes
    // back "invalid version byte. expected 48, got 16" — so every read on a passkey user's
    // treasury failed and the UI reported the treasury might not exist.
    const t = makeTreasury(DEPLOYED, executor(SMART_WALLET, "passkey"));
    expect((t.client.options as { publicKey?: string }).publicKey).toBeUndefined();
  });

  it("keeps handing a wallet session its own address", () => {
    const g = "GDPKXL6CNHUXBV4PM54CPTRZNQRYVTIMO4YGBW3M2MNSCMQ7TTNINXP6";
    const t = makeTreasury(DEPLOYED, executor(g, "wallet"));
    expect((t.client.options as { publicKey?: string }).publicKey).toBe(g);
  });
});

describe("deployTreasury", () => {
  it("deploys through the session's own deploy path when it has one", async () => {
    // A passkey session cannot deploy from a transaction source account: the smart wallet
    // holds no XLM, and the relayer that pays for it rejects source-account authorisation.
    const deployContract = vi.fn().mockResolvedValue(DEPLOYED);
    const executor = {
      address: SMART_WALLET,
      kind: "passkey",
      signer: { signTransaction: vi.fn() },
      submit: vi.fn(),
      deployContract,
    } as unknown as TxExecutor;

    await expect(deployTreasury(executor, 100, 10)).resolves.toBe(DEPLOYED);

    const [wasmHash, args] = deployContract.mock.calls[0];
    expect(wasmHash).toBe(TREASURY_WASM_HASH);
    // admin and agent are both the smart wallet: ownership rides on the constructor
    // arguments, never on whoever submitted the transaction.
    expect(Address.fromScVal(args[0]).toString()).toBe(SMART_WALLET);
    expect(Address.fromScVal(args[1]).toString()).toBe(SMART_WALLET);
    expect(Address.fromScVal(args[2]).toString()).toBe(XLM_SAC);
    expect(scValToNative(args[3])).toBe(toStroops(100));
    expect(scValToNative(args[4])).toBe(toStroops(10));
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

// --- H2 (2026-08-05 audit): registry poisoning ---------------------------------
describe("isOwnedBy", () => {
  const ME = "GBGHXQXR7BQZMZ3EPWXVMBNVFHXHVZQJPVWQGCTLPXQHRTFHXQXR7BQZ";
  const THEM = "GDPKXL6CNHUXBV4PM54CPTRZNQRYVTIMO4YGBW3M2MNSCMQ7TTNINXP6";

  it("accepts a treasury whose on-chain admin is the connected wallet", () => {
    expect(isOwnedBy({ admin: ME } as EunomiaState, ME)).toBe(true);
  });

  // TreasuryRegistry.register() records an unverified claim: anyone can register
  // ANY contract address under their own name, and the app auto-adopts the newest
  // entry on a fresh device. Without this check a single signature on a
  // zero-value "back up your treasury" call could point a victim at a treasury
  // the attacker administers - and the victim would fund it.
  it("rejects a treasury administered by somebody else", () => {
    expect(isOwnedBy({ admin: THEM } as EunomiaState, ME)).toBe(false);
  });

  it("rejects rather than assumes when there is no state to check", () => {
    expect(isOwnedBy(null, ME)).toBe(false);
  });

  it("rejects when no wallet is connected", () => {
    expect(isOwnedBy({ admin: ME } as EunomiaState, null)).toBe(false);
  });
});
