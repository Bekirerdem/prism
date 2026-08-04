import { describe, it, expect, vi } from "vitest";
import { makePasskeyWallet, type PasskeyBackend } from "./passkey";

const CONTRACT = "CAYWNXHANRY5GSJAZOR4YTKBKNOKTCITE52ZRKDKCAWLDTYWFFVFSPAZ";
const KEY_ID = "AAECAwQFBgcICQoLDA0ODw";

const backend = (over: Partial<PasskeyBackend> = {}): PasskeyBackend => ({
  createWallet: vi
    .fn()
    .mockResolvedValue({ contractId: CONTRACT, signedTx: "DEPLOY_XDR", keyId: KEY_ID }),
  connectWallet: vi.fn().mockResolvedValue({ contractId: CONTRACT, keyId: KEY_ID }),
  connected: vi.fn().mockReturnValue(false),
  sign: vi.fn().mockImplementation((tx) => Promise.resolve({ ...tx, signed: true })),
  signAuthEntry: vi.fn().mockImplementation((e) => Promise.resolve({ ...e, signed: true })),
  ...over,
});

describe("makePasskeyWallet", () => {
  it("registers a passkey and returns the wallet address, deploy transaction and key id", async () => {
    // createWallet does NOT submit — it hands back a signed deploy tx for the relay.
    // The key id comes back too: it is what lets a later session re-attach without a ceremony.
    const be = backend();
    const w = makePasskeyWallet(be, "Eunomia");

    await expect(w.create("bekir")).resolves.toEqual({
      contractId: CONTRACT,
      signedTx: "DEPLOY_XDR",
      keyId: KEY_ID,
    });
    expect(be.createWallet).toHaveBeenCalledWith("Eunomia", "bekir");
  });

  it("connects an existing wallet and returns its address", async () => {
    const be = backend();
    const w = makePasskeyWallet(be, "Eunomia");

    await expect(w.connect()).resolves.toEqual({ contractId: CONTRACT, keyId: KEY_ID });
  });

  it("connects a known key id directly, skipping the discovery ceremony", async () => {
    const be = backend();
    const w = makePasskeyWallet(be, "Eunomia");

    await w.connect(KEY_ID);

    expect(be.connectWallet).toHaveBeenCalledWith(KEY_ID);
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

  it("signs a single auth entry", async () => {
    // Deploying a treasury is not a contract-client call, so there is no AssembledTransaction
    // to hand over — only the one auth entry simulation produced.
    const be = backend();
    const w = makePasskeyWallet(be, "Eunomia");

    await expect(w.signAuthEntry({ entry: 1 })).resolves.toEqual({ entry: 1, signed: true });
  });

  describe("ensureConnected", () => {
    // The regression this whole block guards: every call to executorFor() built a FRESH kit,
    // and a fresh kit holds no wallet. passkey-kit's sign() throws "A wallet must be connected"
    // in that state, which reached the user as "Couldn't use your passkey" — on treasury
    // creation and on every payment after it.
    it("re-attaches a kit that holds no wallet, using the stored key id", async () => {
      const be = backend({ connected: vi.fn().mockReturnValue(false) });
      const w = makePasskeyWallet(be, "Eunomia");

      await w.ensureConnected(KEY_ID);

      expect(be.connectWallet).toHaveBeenCalledWith(KEY_ID);
    });

    it("does nothing when the kit is already connected", async () => {
      const be = backend({ connected: vi.fn().mockReturnValue(true) });
      const w = makePasskeyWallet(be, "Eunomia");

      await w.ensureConnected(KEY_ID);

      expect(be.connectWallet).not.toHaveBeenCalled();
    });

    it("falls back to the discovery ceremony when no key id was stored", async () => {
      // A passkey created before key ids were persisted still has to be able to sign.
      const be = backend({ connected: vi.fn().mockReturnValue(false) });
      const w = makePasskeyWallet(be, "Eunomia");

      await w.ensureConnected(undefined);

      expect(be.connectWallet).toHaveBeenCalledWith(undefined);
    });
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
