// Two things differ between the wallet path and the passkey path: who signs, and who submits.
// ContractSigner already covered the first. TxExecutor covers both, so the treasury operations
// stay indifferent to which door the user came in through.
//
// The wallet path is preserved exactly: the wallet signs each transaction and the contract
// client submits it over RPC, hash read from the same field as before.
//
// The passkey path cannot use RPC at all — a smart wallet holds no XLM, so there is nobody to
// pay the fee. It signs the assembled transaction with the passkey and hands it to the relay,
// which submits from its own channel account.
import type { ContractSigner } from "./walletSigner";
import type { PasskeyWallet } from "./passkey";

/** The shape every contract-client transaction shares — enough to submit it. */
export interface SubmittableTx {
  signAndSend: () => Promise<unknown>;
}

export interface TxExecutor {
  /** The account that owns the treasury: a G-address for wallets, a C-address for passkeys. */
  address: string;
  kind: "wallet" | "passkey";
  /** Handed to the contract client when it is built. */
  signer: ContractSigner;
  /** Sign and submit, returning the on-chain hash when there is one. */
  submit: (tx: SubmittableTx) => Promise<{ hash?: string }>;
}

/** The existing path, unchanged. */
export function makeWalletExecutor(address: string, signer: ContractSigner): TxExecutor {
  return {
    address,
    kind: "wallet",
    signer,
    submit: async (tx) => {
      const sent = await tx.signAndSend();
      const hash = (sent as { sendTransactionResponse?: { hash?: string } }).sendTransactionResponse
        ?.hash;
      return { hash };
    },
  };
}

/** The passkey path: the smart wallet signs the assembled transaction, the relay submits it. */
export function makePasskeyExecutor(
  contractId: string,
  wallet: PasskeyWallet,
  relay: (tx: SubmittableTx) => Promise<{ hash?: string }>,
): TxExecutor {
  return {
    address: contractId,
    kind: "passkey",
    signer: {
      // The kit signs AssembledTransactions, never raw XDR. Anything reaching for this
      // callback has routed a passkey session down the wallet path by mistake.
      signTransaction: () =>
        Promise.reject(new Error("A passkey session signs transactions, not raw XDR.")),
    },
    submit: async (tx) => relay(await wallet.sign(tx)),
  };
}
