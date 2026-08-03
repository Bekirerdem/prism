import { describe, it, expect, vi } from "vitest";
import { makeWalletExecutor, makePasskeyExecutor } from "./executor";

const G = "GBGHXQXR7BQZMZ3EPWXVMBNVFHXHVZQJPVWQGCTLPXQHRTFHXQXR7BQZ";
const C = "CAYWNXHANRY5GSJAZOR4YTKBKNOKTCITE52ZRKDKCAWLDTYWFFVFSPAZ";

describe("makePasskeyExecutor — auth-free submissions", () => {
  const wallet = () => ({
    create: vi.fn(),
    connect: vi.fn(),
    sign: vi.fn().mockImplementation((tx) => Promise.resolve({ ...tx, signed: true })),
  });

  it("skips the passkey prompt when the transaction carries no contract auth", async () => {
    // Deploy is this case: the treasury does not exist yet and __constructor calls no
    // require_auth(), so signing would ask for a passkey the transaction cannot use — which is
    // exactly how "Couldn't use your passkey" was reached before a treasury could be created.
    const w = wallet();
    const relay = vi.fn().mockResolvedValue({ hash: "deployed" });
    const ex = makePasskeyExecutor(C, w, relay);

    const tx = { signAndSend: vi.fn() };
    await expect(ex.submit(tx, { requiresAuth: false })).resolves.toEqual({ hash: "deployed" });

    expect(w.sign).not.toHaveBeenCalled();
    expect(relay).toHaveBeenCalledWith(tx);
  });

  it("still signs by default, so every other treasury call is unaffected", async () => {
    const w = wallet();
    const relay = vi.fn().mockResolvedValue({ hash: "signed" });
    const ex = makePasskeyExecutor(C, w, relay);

    await ex.submit({ signAndSend: vi.fn() });

    expect(w.sign).toHaveBeenCalledTimes(1);
    expect(relay).toHaveBeenCalledWith(expect.objectContaining({ signed: true }));
  });
});

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
    sign: vi.fn().mockImplementation((tx) => Promise.resolve({ ...tx, signed: true })),
  });

  it("uses the smart wallet address and marks the passkey path", () => {
    const ex = makePasskeyExecutor(C, wallet(), vi.fn());
    expect(ex.address).toBe(C);
    expect(ex.kind).toBe("passkey");
  });

  it("signs with the passkey and relays instead of touching RPC", async () => {
    const w = wallet();
    const signAndSend = vi.fn();
    const relay = vi.fn().mockResolvedValue({ hash: "relayed1" });
    const ex = makePasskeyExecutor(C, w, relay);

    await expect(ex.submit({ signAndSend, built: { operations: [] } })).resolves.toEqual({ hash: "relayed1" });

    expect(w.sign).toHaveBeenCalledWith({ signAndSend, built: { operations: [] } });
    expect(relay).toHaveBeenCalledWith({ signAndSend, built: { operations: [] }, signed: true });
    // The passkey wallet has no XLM of its own — going to RPC would fail on fees.
    expect(signAndSend).not.toHaveBeenCalled();
  });

  it("exposes a signer that refuses the callback path", async () => {
    // Nothing should route a passkey session through the wallet-style XDR callback; failing
    // loudly here beats a confusing signature error deeper in the SDK.
    const ex = makePasskeyExecutor(C, wallet(), vi.fn());
    await expect(ex.signer.signTransaction("XDR")).rejects.toThrow(/passkey/i);
  });
});
