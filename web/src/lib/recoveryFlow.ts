// Recovery orchestration: what happens between "user clicked" and "signer on
// chain", with the wallet seam and the relay injected so it unit-tests offline.
//
// Two flows share these deps:
//   - onboarding mints a code and activates the scoped signer (two calls, so the
//     UI can show the code and demand a "saved it" before anything is on chain);
//   - recovery turns a pasted code into a fresh passkey session.
import type { PasskeyIdentity, PasskeyWallet } from "./passkey";
import { formatRecoveryCode, generateRecoveryKey, parseRecoveryCode } from "./recovery";

export interface RecoveryDeps {
  wallet: PasskeyWallet;
  relayTx: (tx: unknown) => Promise<{ hash?: string }>;
}

/** A fresh code for this wallet. Nothing touches the chain yet — the signer is
 *  only worth writing once the user has confirmed the code is saved. */
export function mintRecoveryCode(walletContractId: string): {
  code: string;
  publicKey: string;
} {
  const { publicKey, secret } = generateRecoveryKey();
  return { code: formatRecoveryCode(secret, walletContractId), publicKey };
}

/** Write the wallet-scoped recovery signer on chain. One passkey prompt. */
export function activateRecoverySigner(
  deps: RecoveryDeps,
  publicKey: string,
  walletContractId: string,
): Promise<{ hash?: string }> {
  return deps.wallet
    .addRecoverySigner(publicKey, walletContractId)
    .then((signed) => deps.relayTx(signed));
}

/** Turn a pasted recovery code into a connected session with a fresh passkey.
 *
 *  The code is validated BEFORE the WebAuthn ceremony: nobody should touch
 *  their authenticator only to be told the paste was wrong. */
export async function recoverWallet(
  deps: RecoveryDeps,
  rawCode: string,
  userLabel: string,
): Promise<PasskeyIdentity> {
  const { secret, wallet } = parseRecoveryCode(rawCode);

  const { keyId, publicKey } = await deps.wallet.createKey(userLabel);
  const signed = await deps.wallet.addPasskeyFromRecovery(wallet, keyId, publicKey, secret);
  await deps.relayTx(signed);

  return deps.wallet.connectRecovered(keyId, wallet);
}
