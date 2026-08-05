// Recovery-code primitives, kept free of passkey-kit so they unit-test without
// WebAuthn or the DOM.
//
// The code is self-contained: `EUN1.<secret>.<wallet>`. Carrying the wallet
// address inside the code means recovery on a fresh device needs no database,
// no indexer and no working backend — the one string the user saved is enough
// to find the wallet and prove the right to re-key it.
import { Keypair, StrKey } from "@stellar/stellar-sdk";

export interface RecoveryKey {
  publicKey: string;
  secret: string;
}

export interface RecoveryCode {
  secret: string;
  wallet: string;
}

/** A fresh Ed25519 keypair. The secret is shown to the user exactly once. */
export function generateRecoveryKey(): RecoveryKey {
  const kp = Keypair.random();
  return { publicKey: kp.publicKey(), secret: kp.secret() };
}

const PREFIX = "EUN1";

/** The one string the user saves: version, recovery secret, wallet address. */
export function formatRecoveryCode(secret: string, wallet: string): string {
  return `${PREFIX}.${secret}.${wallet}`;
}

const NOT_A_CODE =
  "That doesn't look like a recovery code — it starts with EUN1 and has three parts separated by dots.";

/** Clean and validate a pasted recovery code, or throw a user-facing message.
 *
 *  Pasted text smuggles zero-width characters, BOMs and case changes that
 *  survive trim() and break StrKey parsing downstream — same trap as the
 *  env-var BOM. */
export function parseRecoveryCode(input: string): RecoveryCode {
  const cleaned = input
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .toUpperCase();

  if (StrKey.isValidEd25519SecretSeed(cleaned)) {
    throw new Error(
      "That's only the key part — the full recovery code starts with EUN1 and includes your wallet address.",
    );
  }

  const [prefix, secret, wallet, ...rest] = cleaned.split(".");
  if (
    prefix !== PREFIX ||
    rest.length > 0 ||
    !StrKey.isValidEd25519SecretSeed(secret ?? "") ||
    !StrKey.isValidContract(wallet ?? "")
  ) {
    throw new Error(NOT_A_CODE);
  }

  return { secret, wallet };
}

/** Signer limits that confine a signer to the wallet contract itself.
 *
 *  In passkey-kit's SignerLimits, a present key with an undefined value means
 *  "unrestricted on that contract" — and the absence of every other contract
 *  means no authority anywhere else. A recovery signer scoped this way can
 *  add or remove signers, but cannot authorize a treasury call or a token
 *  transfer. That does NOT make a stolen code harmless — re-keying grants a
 *  new passkey full rights — but it does mean a thief can never spend
 *  quietly: takeover requires an on-chain add_signer first. */
export function walletOnlyLimits(
  walletContractId: string,
): Map<string, undefined> {
  return new Map([[walletContractId, undefined]]);
}
