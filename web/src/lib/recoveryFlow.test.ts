import { describe, it, expect, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  activateRecoverySigner,
  mintRecoveryCode,
  recoverWallet,
  type RecoveryDeps,
} from "./recoveryFlow";
import { parseRecoveryCode } from "./recovery";
import type { PasskeyWallet } from "./passkey";

const WALLET = "CAYWNXHANRY5GSJAZOR4YTKBKNOKTCITE52ZRKDKCAWLDTYWFFVFSPAZ";
const KEY_ID = "AAECAwQFBgcICQoLDA0ODw";
const PUBKEY = new Uint8Array([4, 1, 2, 3]);

const fakeWallet = (over: Partial<PasskeyWallet> = {}): PasskeyWallet => ({
  create: vi.fn(),
  connect: vi.fn(),
  ensureConnected: vi.fn(),
  sign: vi.fn(),
  signAuthEntry: vi.fn(),
  createKey: vi.fn().mockResolvedValue({ keyId: KEY_ID, publicKey: PUBKEY }),
  addRecoverySigner: vi.fn().mockResolvedValue({ signedAdd: true }),
  addPasskeyFromRecovery: vi.fn().mockResolvedValue({ signedRekey: true }),
  connectRecovered: vi.fn().mockResolvedValue({ contractId: WALLET, keyId: KEY_ID }),
  ...over,
});

const deps = (over: Partial<RecoveryDeps> = {}): RecoveryDeps => ({
  wallet: fakeWallet(),
  relayTx: vi.fn().mockResolvedValue({ hash: "abc123" }),
  ...over,
});

describe("mintRecoveryCode", () => {
  it("mints a parseable code whose public key matches the secret inside it", () => {
    const { code, publicKey } = mintRecoveryCode(WALLET);

    const parsed = parseRecoveryCode(code);
    expect(parsed.wallet).toBe(WALLET);
    expect(Keypair.fromSecret(parsed.secret).publicKey()).toBe(publicKey);
  });
});

describe("activateRecoverySigner", () => {
  it("writes the scoped signer through the relay", async () => {
    const d = deps();

    await expect(activateRecoverySigner(d, "GPUBLIC", WALLET)).resolves.toEqual({
      hash: "abc123",
    });
    expect(d.wallet.addRecoverySigner).toHaveBeenCalledWith("GPUBLIC", WALLET);
    expect(d.relayTx).toHaveBeenCalledWith({ signedAdd: true });
  });
});

describe("recoverWallet", () => {
  const goodCode = () => mintRecoveryCode(WALLET).code;

  it("re-keys the wallet and connects the new passkey session", async () => {
    const d = deps();

    await expect(recoverWallet(d, goodCode(), "bekir")).resolves.toEqual({
      contractId: WALLET,
      keyId: KEY_ID,
    });

    expect(d.wallet.createKey).toHaveBeenCalledWith("bekir");
    expect(d.wallet.addPasskeyFromRecovery).toHaveBeenCalledWith(
      WALLET,
      KEY_ID,
      PUBKEY,
      expect.stringMatching(/^S[A-Z2-7]{55}$/),
    );
    expect(d.relayTx).toHaveBeenCalledWith({ signedRekey: true });
    expect(d.wallet.connectRecovered).toHaveBeenCalledWith(KEY_ID, WALLET);
  });

  it("rejects a bad code before any WebAuthn ceremony runs", async () => {
    // The code is validated first: nobody should touch their authenticator only
    // to be told the paste was wrong.
    const d = deps();

    await expect(recoverWallet(d, "garbage", "bekir")).rejects.toThrow(/recovery code/i);
    expect(d.wallet.createKey).not.toHaveBeenCalled();
  });

  it("does not connect when the relay rejects the re-key", async () => {
    const d = deps({ relayTx: vi.fn().mockRejectedValue(new Error("Couldn't submit")) });

    await expect(recoverWallet(d, goodCode(), "bekir")).rejects.toThrow(/submit/i);
    expect(d.wallet.connectRecovered).not.toHaveBeenCalled();
  });
});
