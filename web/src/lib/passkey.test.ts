import { describe, it, expect, vi } from "vitest";
import { makePasskeyWallet, type PasskeyBackend } from "./passkey";

const CONTRACT = "CAYWNXHANRY5GSJAZOR4YTKBKNOKTCITE52ZRKDKCAWLDTYWFFVFSPAZ";

const backend = (over: Partial<PasskeyBackend> = {}): PasskeyBackend => ({
  createWallet: vi.fn().mockResolvedValue({ contractId: CONTRACT, signedTx: "DEPLOY_XDR" }),
  connectWallet: vi.fn().mockResolvedValue({ contractId: CONTRACT }),
  sign: vi.fn().mockImplementation((tx) => Promise.resolve({ ...tx, signed: true })),
  ...over,
});

describe("makePasskeyWallet", () => {
  it("registers a passkey and returns both the wallet address and the deploy transaction", async () => {
    // createWallet does NOT submit — it hands back a signed deploy tx for the relay.
    const be = backend();
    const w = makePasskeyWallet(be, "Eunomia");

    await expect(w.create("bekir")).resolves.toEqual({ contractId: CONTRACT, signedTx: "DEPLOY_XDR" });
    expect(be.createWallet).toHaveBeenCalledWith("Eunomia", "bekir");
  });

  it("connects an existing wallet and returns its address", async () => {
    const be = backend();
    const w = makePasskeyWallet(be, "Eunomia");

    await expect(w.connect()).resolves.toBe(CONTRACT);
  });

  it("passes an assembled transaction through the kit's signer", async () => {
    // The kit signs AssembledTransactions, not raw XDR strings — the wallet auth entries
    // are filled in place, which is why the object round-trips rather than a string.
    const be = backend();
    const w = makePasskeyWallet(be, "Eunomia");

    await expect(w.sign({ id: 1 })).resolves.toEqual({ id: 1, signed: true });
    expect(be.sign).toHaveBeenCalledWith({ id: 1 });
  });

  it("turns a dismissed OS prompt into something the user can act on", async () => {
    const be = backend({
      createWallet: vi.fn().mockRejectedValue(
        new Error("NotAllowedError: The operation either timed out or was not allowed"),
      ),
    });
    const w = makePasskeyWallet(be, "Eunomia");

    await expect(w.create("bekir")).rejects.toThrow(/cancelled/i);
    await expect(w.create("bekir")).rejects.not.toThrow(/NotAllowedError/);
  });

  it("keeps a wallet-ownership failure distinct — that one is not a cancellation", async () => {
    // The kit verifies that the passkey really is a signer on the wallet it resolved;
    // telling the user "cancelled" there would send them in circles.
    const be = backend({
      connectWallet: vi.fn().mockRejectedValue(new Error("WalletOwnershipError: keyId is not a signer")),
    });
    const w = makePasskeyWallet(be, "Eunomia");

    await expect(w.connect()).rejects.toThrow(/couldn't open your wallet/i);
  });
});
