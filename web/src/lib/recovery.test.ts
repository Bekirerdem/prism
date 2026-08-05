import { describe, it, expect } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  formatRecoveryCode,
  generateRecoveryKey,
  parseRecoveryCode,
  walletOnlyLimits,
} from "./recovery";

const WALLET = "CAYWNXHANRY5GSJAZOR4YTKBKNOKTCITE52ZRKDKCAWLDTYWFFVFSPAZ";

describe("generateRecoveryKey", () => {
  it("returns a keypair whose secret reconstructs the public key", () => {
    const { publicKey, secret } = generateRecoveryKey();

    expect(publicKey).toMatch(/^G[A-Z2-7]{55}$/);
    expect(secret).toMatch(/^S[A-Z2-7]{55}$/);
    expect(Keypair.fromSecret(secret).publicKey()).toBe(publicKey);
  });

  it("returns a different key every time", () => {
    expect(generateRecoveryKey().secret).not.toBe(generateRecoveryKey().secret);
  });
});

describe("recovery code format", () => {
  it("round-trips through format and parse", () => {
    const secret = Keypair.random().secret();

    const code = formatRecoveryCode(secret, WALLET);

    expect(code).toBe(`EUN1.${secret}.${WALLET}`);
    expect(parseRecoveryCode(code)).toEqual({ secret, wallet: WALLET });
  });

  it("survives the whitespace, invisible characters and lowercasing a paste can carry", () => {
    // Same trap as the env-var BOM: copied text smuggles zero-width chars that
    // survive trim() and break StrKey parsing downstream. Escapes, not literals,
    // so the invisibles are visible to a reader (and to eslint).
    const secret = Keypair.random().secret();
    const pasted = `\uFEFF  ${`EUN1.${secret}.${WALLET}`.toLowerCase()}\u200B\r\n`;

    expect(parseRecoveryCode(pasted)).toEqual({ secret, wallet: WALLET });
  });

  it("tells a user who saved only the secret that the code has more parts", () => {
    expect(() => parseRecoveryCode(Keypair.random().secret())).toThrow(/EUN1/);
  });

  it("rejects a code whose wallet part is damaged", () => {
    const secret = Keypair.random().secret();

    expect(() => parseRecoveryCode(`EUN1.${secret}.CAYWNX`)).toThrow(/recovery code/i);
  });

  it("rejects a code whose key part is damaged, without leaking SDK terms", () => {
    expect(() => parseRecoveryCode(`EUN1.SABC.${WALLET}`)).toThrow(/recovery code/i);
    expect(() => parseRecoveryCode(`EUN1.SABC.${WALLET}`)).not.toThrow(/checksum|base32/i);
  });

  it("rejects garbage and empty input with a user-facing message", () => {
    expect(() => parseRecoveryCode("not-a-code")).toThrow(/recovery code/i);
    expect(() => parseRecoveryCode("   ")).toThrow(/recovery code/i);
  });
});

describe("walletOnlyLimits", () => {
  it("scopes the signer to the wallet contract and nothing else", () => {
    const limits = walletOnlyLimits(WALLET);

    expect(limits.size).toBe(1);
    expect(limits.has(WALLET)).toBe(true);
    // undefined value = unrestricted on THAT contract; absence of other keys
    // = no authority anywhere else. This is what keeps a stolen recovery code
    // from spending: it can manage signers, it cannot touch a treasury.
    expect(limits.get(WALLET)).toBeUndefined();
  });
});
