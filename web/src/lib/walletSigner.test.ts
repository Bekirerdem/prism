import { describe, it, expect, vi } from "vitest";
import { makeWalletSigner } from "./walletSigner";

const PASS = "Test SDF Network ; September 2015";

describe("makeWalletSigner", () => {
  it("signs with the bound address + default passphrase and maps to the contract-signer shape", async () => {
    const signTransaction = vi.fn().mockResolvedValue({ signedTxXdr: "SIGNED" });
    const signer = makeWalletSigner({ signTransaction }, "GADDR", PASS);

    const out = await signer.signTransaction("XDR");

    expect(signTransaction).toHaveBeenCalledWith("XDR", {
      networkPassphrase: PASS,
      address: "GADDR",
    });
    // contract Client expects { signedTxXdr, signerAddress }; signerAddress falls back to the bound address
    expect(out).toEqual({ signedTxXdr: "SIGNED", signerAddress: "GADDR" });
  });

  it("honours an explicit passphrase and the kit's own signerAddress when returned", async () => {
    const signTransaction = vi.fn().mockResolvedValue({ signedTxXdr: "S2", signerAddress: "GKIT" });
    const signer = makeWalletSigner({ signTransaction }, "GADDR", PASS);

    const out = await signer.signTransaction("XDR", { networkPassphrase: "OTHER" });

    expect(signTransaction).toHaveBeenCalledWith("XDR", { networkPassphrase: "OTHER", address: "GADDR" });
    expect(out).toEqual({ signedTxXdr: "S2", signerAddress: "GKIT" });
  });

  // A WalletConnect session that the wallet dropped leaves the kit signing against a topic
  // that no longer exists: the phone showed "confirm in your wallet…" while no wallet ever
  // opened, and the raw core error leaked to the user (reported 2026-07-28).
  describe("when the wallet session is gone", () => {
    const stale = () =>
      Promise.reject(
        new Error(
          "Missing or invalid. Record was recently deleted - session: 7e677fb9caa3008fb0d7673ab69b1601633b4bb8a735a5",
        ),
      );

    it("clears the dead session so the next attempt can reconnect", async () => {
      const onStaleSession = vi.fn();
      const signer = makeWalletSigner({ signTransaction: stale }, "GADDR", PASS, onStaleSession);

      await expect(signer.signTransaction("XDR")).rejects.toThrow();

      expect(onStaleSession).toHaveBeenCalledTimes(1);
    });

    it("replaces the raw session topic with something the user can act on", async () => {
      const signer = makeWalletSigner({ signTransaction: stale }, "GADDR", PASS, vi.fn());

      await expect(signer.signTransaction("XDR")).rejects.toThrow(
        /wallet connection expired.*reconnect/i,
      );
      await expect(signer.signTransaction("XDR")).rejects.not.toThrow(/7e677fb9/);
    });

    it("leaves unrelated signing failures alone", async () => {
      const onStaleSession = vi.fn();
      const signTransaction = vi.fn().mockRejectedValue(new Error("User declined the request"));
      const signer = makeWalletSigner({ signTransaction }, "GADDR", PASS, onStaleSession);

      await expect(signer.signTransaction("XDR")).rejects.toThrow("User declined the request");
      expect(onStaleSession).not.toHaveBeenCalled();
    });
  });
});
