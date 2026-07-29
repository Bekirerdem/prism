// Test-only signer injection — bypasses the real wallet modal for E2E tests.
// Gated behind VITE_ENABLE_TEST_SIGNER: the adapter code is a no-op when the
// env flag isn't set (import.meta.env flags are compile-time constants, so the
// dead branch gets tree-shaken out of production builds entirely).
//
// Playwright injects a window.__PRISM_TEST_SIGNER__ global before the page
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
    __PRISM_TEST_SIGNER__?: {
      secretKey: string;
    };
  }
}

const TEST_SIGNER_ENABLED: boolean =
  (import.meta.env.VITE_ENABLE_TEST_SIGNER as string | undefined) === "true";

export interface InjectedTestSigner {
  address: string;
  kitSigner: KitSigner;
  secretKey: string;
}

/** True when the test-signer build flag is set AND the page has the injected global. */
export function testSignerAvailable(): boolean {
  if (!TEST_SIGNER_ENABLED) return false;
  return typeof window !== "undefined" && !!window.__PRISM_TEST_SIGNER__?.secretKey;
}

/**
 * Build a contract-client-compatible signer backed by the injected testnet key.
 * Signs directly with stellar-sdk's Keypair — no wallet extension, no popup.
 *
 * Safe to call only after testSignerAvailable() returns true.
 */
export function getTestSigner(): InjectedTestSigner | null {
  if (!testSignerAvailable()) return null;
  const secretKey = window.__PRISM_TEST_SIGNER__!.secretKey;
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
