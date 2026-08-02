// Thin seam over passkey-kit. The kit is injected so this file unit-tests without WebAuthn
// or the DOM — the same pattern walletSigner.ts uses for StellarWalletsKit.
//
// Two things about the kit shape the design here:
//   - `createWallet` does not submit anything. It registers the passkey, derives the wallet
//     address and hands back a SIGNED DEPLOY TRANSACTION for us to relay.
//   - `sign` takes an AssembledTransaction, not an XDR string: it fills in the wallet's auth
//     entries in place. So the passkey path signs at the transaction level, not the callback
//     level the wallet path uses.
//
// Raw WebAuthn and kit errors never reach the user.

export interface PasskeyBackend {
  createWallet(app: string, user: string): Promise<{ contractId: string; signedTx: string }>;
  connectWallet(): Promise<{ contractId: string }>;
  sign<T>(tx: T): Promise<T>;
}

export interface PasskeyWallet {
  /** Register a passkey. The returned deploy transaction still has to be submitted. */
  create(user: string): Promise<{ contractId: string; signedTx: string }>;
  /** Resolve the wallet behind an existing passkey. */
  connect(): Promise<string>;
  /** Fill in the wallet's auth entries on an assembled transaction. */
  sign<T>(tx: T): Promise<T>;
}

const CANCELLED = "Passkey prompt cancelled — try again.";
const OWNERSHIP = "We couldn't open your wallet with that passkey. Try connecting a wallet instead.";
const GENERIC = "Couldn't use your passkey. Try again or connect a wallet instead.";

/** The browser reports a dismissed prompt and a timeout the same way (NotAllowedError), and
 *  neither is worth showing verbatim. An ownership failure is kept separate: telling that user
 *  "cancelled" would send them round in circles. */
function humanise(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/ownership/i.test(msg)) return new Error(OWNERSHIP);
  if (/notallowed|aborterror|timed out|cancel/i.test(msg)) return new Error(CANCELLED);
  return new Error(GENERIC);
}

/** The only place that touches passkey-kit directly. If the kit's signatures shift, this
 *  function is the single thing that changes — nothing else in the app knows about it. */
export async function realPasskeyBackend(): Promise<PasskeyBackend> {
  const { PasskeyKit } = await import("passkey-kit");
  const { RPC_URL, NETWORK_PASSPHRASE, WALLET_WASM_HASH, RP_ID } = await import("../config");

  const kit = new PasskeyKit({
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK_PASSPHRASE,
    walletWasmHash: WALLET_WASM_HASH,
    ...(RP_ID ? { rpId: RP_ID } : {}),
  });

  return {
    createWallet: async (app, user) => {
      const { contractId, signedTx } = await kit.createWallet(app, user);
      return { contractId, signedTx };
    },
    connectWallet: async () => ({ contractId: (await kit.connectWallet()).contractId }),
    sign: (tx) => kit.sign(tx as never) as never,
  };
}

export function makePasskeyWallet(backend: PasskeyBackend, app: string): PasskeyWallet {
  return {
    async create(user) {
      try {
        const { contractId, signedTx } = await backend.createWallet(app, user);
        return { contractId, signedTx };
      } catch (e) {
        throw humanise(e);
      }
    },
    async connect() {
      try {
        return (await backend.connectWallet()).contractId;
      } catch (e) {
        throw humanise(e);
      }
    },
    async sign(tx) {
      try {
        return await backend.sign(tx);
      } catch (e) {
        throw humanise(e);
      }
    },
  };
}
