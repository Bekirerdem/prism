import { describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  treasuries_of: vi.fn(),
  register: vi.fn(),
}));

vi.mock("./registryClient", () => ({
  // A real class so `new Client(...)` works — arrow-fn mocks aren't constructable.
  Client: class {
    treasuries_of = mocks.treasuries_of;
    register = mocks.register;
  },
}));

import { discoverTreasuries, registerTreasury } from "./registry";

// Real, checksum-valid contract ids — discoverTreasuries StrKey-filters its results.
const T1 = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const T2 = "CBEPVXK6BN2FZ3IYHV5KQUGROFHNBWBYHKHRZ5U3O7UWGIOPFOFE4ZE7";

describe("discoverTreasuries", () => {
  it("returns the wallet's registered treasuries", async () => {
    mocks.treasuries_of.mockResolvedValueOnce({ result: [T1, T2] });
    expect(await discoverTreasuries("GADDR")).toEqual([T1, T2]);
  });

  it("filters malformed ids so a bad registry entry can't wedge the workspace", async () => {
    mocks.treasuries_of.mockResolvedValueOnce({ result: ["not-a-contract", T1, "C1"] });
    expect(await discoverTreasuries("GADDR")).toEqual([T1]);
  });

  it("returns [] when the registry is unreachable (recovery must never break connect)", async () => {
    mocks.treasuries_of.mockRejectedValueOnce(new Error("rpc down"));
    expect(await discoverTreasuries("GADDR")).toEqual([]);
  });

  it("returns [] for a missing result", async () => {
    mocks.treasuries_of.mockResolvedValueOnce({ result: undefined });
    expect(await discoverTreasuries("GADDR")).toEqual([]);
  });
});

describe("registerTreasury", () => {
  const executor = (address: string, submit = vi.fn().mockResolvedValue({})) =>
    ({
      address,
      kind: address.startsWith("C") ? "passkey" : "wallet",
      signer: { signTransaction: vi.fn() },
      submit,
    }) as unknown as Parameters<typeof registerTreasury>[0];

  it("builds the register call for the owner and submits through the session", async () => {
    const submit = vi.fn().mockResolvedValue({});
    mocks.register.mockResolvedValueOnce({ signAndSend: vi.fn() });

    await registerTreasury(executor("GADDR", submit), "CTREASURY");

    expect(mocks.register).toHaveBeenCalledWith({ owner: "GADDR", treasury: "CTREASURY" });
    expect(submit).toHaveBeenCalled();
  });

  it("submits a passkey session's registration the same way, through the relay", async () => {
    // The regression: this used to sign with walletSignerFor() and send over RPC, so a
    // passkey user's treasury silently never reached the registry — and cross-device
    // recovery had nothing to find.
    const submit = vi.fn().mockResolvedValue({});
    mocks.register.mockResolvedValueOnce({ signAndSend: vi.fn() });

    await registerTreasury(executor("CWALLET", submit), "CTREASURY");

    expect(mocks.register).toHaveBeenCalledWith({ owner: "CWALLET", treasury: "CTREASURY" });
    expect(submit).toHaveBeenCalled();
  });

  it("propagates a decline so the caller's best-effort catch handles it", async () => {
    mocks.register.mockRejectedValueOnce(new Error("User declined"));
    await expect(registerTreasury(executor("GADDR"), "CTREASURY")).rejects.toThrow("User declined");
  });
});
