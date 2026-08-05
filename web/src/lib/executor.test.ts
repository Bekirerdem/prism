import { describe, it, expect, vi } from "vitest";
import { makeWalletExecutor, makePasskeyExecutor } from "./executor";

const G = "GBGHXQXR7BQZMZ3EPWXVMBNVFHXHVZQJPVWQGCTLPXQHRTFHXQXR7BQZ";
const C = "CAYWNXHANRY5GSJAZOR4YTKBKNOKTCITE52ZRKDKCAWLDTYWFFVFSPAZ";

describe("makeWalletExecutor", () => {
  it("carries the address and marks itself as the wallet path", () => {
    const ex = makeWalletExecutor(G, { signTransaction: vi.fn() });
    expect(ex.address).toBe(G);
    expect(ex.kind).toBe("wallet");
  });

  it("hands the signer through untouched — the wallet path must not change behaviour", () => {
    const signer = { signTransaction: vi.fn() };
    expect(makeWalletExecutor(G, signer).signer).toBe(signer);
  });

  it("submits over the contract client's own RPC and reports the hash", async () => {
    const signAndSend = vi.fn().mockResolvedValue({ sendTransactionResponse: { hash: "abc123" } });
    const ex = makeWalletExecutor(G, { signTransaction: vi.fn() });

    await expect(ex.submit({ signAndSend })).resolves.toEqual({ hash: "abc123" });
    expect(signAndSend).toHaveBeenCalledTimes(1);
  });

  it("reports no hash rather than throwing when the response carries none", async () => {
    const ex = makeWalletExecutor(G, { signTransaction: vi.fn() });
    await expect(ex.submit({ signAndSend: vi.fn().mockResolvedValue({}) })).resolves.toEqual({
      hash: undefined,
    });
  });
});

describe("makePasskeyExecutor", () => {
  const wallet = () => ({
    create: vi.fn(),
    connect: vi.fn(),
    ensureConnected: vi.fn(),
    sign: vi.fn().mockImplementation((tx) => Promise.resolve({ ...tx, signed: true })),
    signAuthEntry: vi.fn(),
    createKey: vi.fn(),
    addRecoverySigner: vi.fn(),
    addPasskeyFromRecovery: vi.fn(),
    connectRecovered: vi.fn(),
  });

  it("uses the smart wallet address and marks the passkey path", () => {
    const ex = makePasskeyExecutor(C, wallet(), vi.fn(), vi.fn(), vi.fn());
    expect(ex.address).toBe(C);
    expect(ex.kind).toBe("passkey");
  });

  it("carries a deploy path, which is what tells the treasury code it cannot use a source account", () => {
    const deploy = vi.fn().mockResolvedValue(C);
    const ex = makePasskeyExecutor(C, wallet(), vi.fn(), deploy, vi.fn());

    expect(ex.deployContract).toBe(deploy);
    // The wallet executor deliberately has none — its presence is the branch condition.
    expect(makeWalletExecutor(G, { signTransaction: vi.fn() }).deployContract).toBeUndefined();
  });

  it("signs with the passkey and relays instead of touching RPC", async () => {
    const w = wallet();
    const signAndSend = vi.fn();
    const relay = vi.fn().mockResolvedValue({ hash: "relayed1" });
    const ex = makePasskeyExecutor(C, w, relay, vi.fn(), vi.fn());

    await expect(ex.submit({ signAndSend, built: { operations: [] } })).resolves.toEqual({ hash: "relayed1" });

    expect(w.sign).toHaveBeenCalledWith({ signAndSend, built: { operations: [] } });
    expect(relay).toHaveBeenCalledWith({ signAndSend, built: { operations: [] }, signed: true });
    // The passkey wallet has no XLM of its own — going to RPC would fail on fees.
    expect(signAndSend).not.toHaveBeenCalled();
  });

  it("exposes a signer that refuses the callback path", async () => {
    // Nothing should route a passkey session through the wallet-style XDR callback; failing
    // loudly here beats a confusing signature error deeper in the SDK.
    const ex = makePasskeyExecutor(C, wallet(), vi.fn(), vi.fn(), vi.fn());
    await expect(ex.signer.signTransaction("XDR")).rejects.toThrow(/passkey/i);
  });
});
