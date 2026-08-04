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

export interface PasskeyIdentity {
  contractId: string;
  /** Base64url credential id — what lets a later session re-attach without a ceremony. */
  keyId: string;
}

export interface PasskeyBackend {
  createWallet(app: string, user: string): Promise<PasskeyIdentity & { signedTx: string }>;
  connectWallet(keyId?: string): Promise<PasskeyIdentity>;
  /** Whether the kit currently holds a connected wallet. A freshly built one does not. */
  connected(): boolean;
  sign<T>(tx: T): Promise<T>;
  signAuthEntry<T>(entry: T): Promise<T>;
}

export interface PasskeyWallet {
  /** Register a passkey. The returned deploy transaction still has to be submitted. */
  create(user: string): Promise<PasskeyIdentity & { signedTx: string }>;
  /** Resolve the wallet behind an existing passkey. Pass a known key id to skip the
   *  discovery ceremony. */
  connect(keyId?: string): Promise<PasskeyIdentity>;
  /** Attach a wallet to the kit if it has none.
   *
   *  passkey-kit refuses to sign anything until a wallet is connected, and a kit built
   *  after a reload — or simply a second kit instance — starts out empty. Reconnecting by
   *  key id costs one ledger read and raises no WebAuthn prompt, so this is safe to call
   *  before every signature. */
  ensureConnected(keyId?: string): Promise<void>;
  /** Fill in the wallet's auth entries on an assembled transaction. */
  sign<T>(tx: T): Promise<T>;
  /** Sign one standalone auth entry — the shape a deploy produces, where there is no
   *  contract-client transaction to hand over. */
  signAuthEntry<T>(entry: T): Promise<T>;
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

/** The kit carries the connection: `kit.wallet` is set by createWallet/connectWallet and is
 *  what sign() checks. Handing out a new kit per call therefore handed out a kit that could
 *  not sign, so the instance is shared for the life of the tab. */
let backend: Promise<PasskeyBackend> | null = null;

/** The only place that touches passkey-kit directly. If the kit's signatures shift, this
 *  function is the single thing that changes — nothing else in the app knows about it. */
export function realPasskeyBackend(): Promise<PasskeyBackend> {
  backend ??= buildPasskeyBackend();
  return backend;
}

/** Drop the shared kit — the session it was connected to is over. */
export function resetPasskeyBackend(): void {
  backend = null;
}

async function buildPasskeyBackend(): Promise<PasskeyBackend> {
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
      const { contractId, signedTx, keyIdBase64 } = await kit.createWallet(app, user);
      return { contractId, signedTx, keyId: keyIdBase64 };
    },
    connectWallet: async (keyId) => {
      const { contractId, keyIdBase64 } = await kit.connectWallet(keyId ? { keyId } : undefined);
      return { contractId, keyId: keyIdBase64 };
    },
    connected: () => !!kit.wallet,
    sign: (tx) => kit.sign(tx as never) as never,
    signAuthEntry: (entry) => kit.signAuthEntry(entry as never) as never,
  };
}

export function makePasskeyWallet(be: PasskeyBackend, app: string): PasskeyWallet {
  return {
    async create(user) {
      try {
        return await be.createWallet(app, user);
      } catch (e) {
        throw humanise(e);
      }
    },
    async connect(keyId) {
      try {
        return await be.connectWallet(keyId);
      } catch (e) {
        throw humanise(e);
      }
    },
    async ensureConnected(keyId) {
      if (be.connected()) return;
      try {
        await be.connectWallet(keyId);
      } catch (e) {
        throw humanise(e);
      }
    },
    async sign(tx) {
      try {
        return await be.sign(tx);
      } catch (e) {
        throw humanise(e);
      }
    },
    async signAuthEntry(entry) {
      try {
        return await be.signAuthEntry(entry);
      } catch (e) {
        throw humanise(e);
      }
    },
  };
}
