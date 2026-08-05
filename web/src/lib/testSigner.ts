// Test-only signer injection — bypasses the real wallet modal for E2E tests.
// Gated behind VITE_ENABLE_TEST_SIGNER: the adapter code is a no-op when the
// env flag isn't set (import.meta.env flags are compile-time constants, so the
// dead branch gets tree-shaken out of production builds entirely).
//
// Playwright injects a window.__EUNOMIA_TEST_SIGNER__ global before the page
// loads — it carries the throwaway testnet secret and a signTransaction
// helper. This module bridges that global into the kit's connection flow
// and contract-client signer shape.

import {
  Keypair,
  TransactionBuilder,
  Networks,
} from "@stellar/stellar-sdk";
import type { KitSigner } from "./walletSigner";

declare global {
  interface Window {
    __EUNOMIA_TEST_SIGNER__?: {
      secretKey: string;
    };
  }
}

/// Gated on `DEV` as well as the flag, and the order matters.
///
/// The flag alone was a process convention, not a control: nothing tied it to the
/// build, so `VITE_ENABLE_TEST_SIGNER=true` reaching a production build environment
/// (a Vercel "All Environments" checkbox, a leaked CI var) would have shipped a
/// connect path that signs treasury operations straight from a page global, with no
/// wallet prompt and no passkey ceremony. `vite build` sets DEV=false regardless of
/// any custom VITE_* value, so the flag can no longer arm anything in production.
/// Leading with the constant also lets the minifier fold this to `false` and drop
/// the branch, instead of leaving the secret-reading code in the public bundle.
const TEST_SIGNER_ENABLED: boolean =
  import.meta.env.DEV &&
  (import.meta.env.VITE_ENABLE_TEST_SIGNER as string | undefined) === "true";

export interface InjectedTestSigner {
  address: string;
  kitSigner: KitSigner;
  secretKey: string;
}

/** True when the test-signer build flag is set AND the page has the injected global. */
export function testSignerAvailable(): boolean {
  if (!TEST_SIGNER_ENABLED) return false;
  return typeof window !== "undefined" && !!window.__EUNOMIA_TEST_SIGNER__?.secretKey;
}

/**
 * Build a contract-client-compatible signer backed by the injected testnet key.
 * Signs directly with stellar-sdk's Keypair — no wallet extension, no popup.
 *
 * Safe to call only after testSignerAvailable() returns true.
 */
export function getTestSigner(): InjectedTestSigner | null {
  // Re-checking the constant (not just testSignerAvailable()) is what lets the
  // minifier prove this whole body unreachable and remove it. Before this, the live
  // bundle still carried the literal `__EUNOMIA_TEST_SIGNER__` and the key-reading
  // logic as dead code — ready-made material for a "paste this in your console to
  // fix your wallet" social-engineering script.
  if (!TEST_SIGNER_ENABLED) return null;
  if (!testSignerAvailable()) return null;
  const secretKey = window.__EUNOMIA_TEST_SIGNER__!.secretKey;
  const keypair = Keypair.fromSecret(secretKey);
  const address = keypair.publicKey();

  const kitSigner: KitSigner = {
    async signTransaction(xdr, opts) {
      const network = opts?.networkPassphrase ?? Networks.TESTNET;
      const tx = TransactionBuilder.fromXDR(xdr, network);
      tx.sign(keypair);
      return {
        signedTxXdr: tx.toXDR(),
        signerAddress: address,
      };
    },
  };

  return { address, kitSigner, secretKey };
}
