// Single shared StellarWalletsKit instance + connection helpers. Extracted from
// Wallet.tsx so both the wallet view and per-user contract calls drive one kit.
// `walletSignerFor` yields a contract-client signer bound to the connected wallet.
import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import { FreighterModule, FREIGHTER_ID } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { AlbedoModule, ALBEDO_ID } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr";
import { RabetModule } from "@creit.tech/stellar-wallets-kit/modules/rabet";
import { HanaModule } from "@creit.tech/stellar-wallets-kit/modules/hana";
import {
  WalletConnectModule,
  WalletConnectTargetChain,
  WALLET_CONNECT_ID,
  type TWalletConnectModuleParams as WalletConnectModuleParams,
} from "@creit.tech/stellar-wallets-kit/modules/wallet-connect";
import { NETWORK_PASSPHRASE } from "../config";
import { makeWalletSigner, type ContractSigner } from "./walletSigner";
import { currentDevice, logFunnel } from "./funnel";
import { errText } from "./wallet-errors";
import { sortWalletsForDevice } from "./walletDevice";

// The extension modules only work on desktop. Freighter (and Lobstr) on a phone connect
// over WalletConnect v2 — so without this module a mobile visitor with the wallet installed
// still sees "not installed". Added first (top of the modal) and only when a project id is
// configured, so the app never crashes without it.
// Same invisible-char trap as supabase.ts: a BOM + CRLF smuggled into the env value made
// Reown reject the project id (403 project-limits) and the WC modal silently never opened.
const WC_PROJECT_ID =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined)?.replace(/[^\x20-\x7E]/g, "") ||
  undefined;

/** Whether WalletConnect is available — the UI uses this to decide if the mobile
 *  pairing hint is worth showing. */
export const wcConfigured = !!WC_PROJECT_ID;

// The full catalogue; walletDevice.ts owns which of these are viable per device —
// mobile drops the extension-only set, keeping web-based Albedo.
const allModules = [
  new FreighterModule(),
  new xBullModule(),
  new AlbedoModule(),
  new LobstrModule(),
  new RabetModule(),
  new HanaModule(),
];
const modules = sortWalletsForDevice(
  currentDevice(),
  allModules.map((module) => ({ id: module.productId, module })),
).map((entry) => entry.module);

// Reown's modal defaults to its EVM catalogue: picking WalletConnect listed dozens of
// Ethereum wallets (`getWallets?chains=eip155:1`), none of which can sign a Stellar
// transaction. Restricting it costs nothing — of the ten Stellar-capable wallets in
// Reown's registry, nine are `stellar:pubnet` only; Freighter is the only one that also
// declares `stellar:testnet`. LOBSTR stays listed for the mainnet milestone.
const STELLAR_WC_WALLETS = [
  "997a355c8f682468706a76cff1b004a7115f505fb962dac54b6e9b442dd1c380", // Freighter
  "76a3d548a08cf402f5c7d021f24fd2881d767084b387a5325df88bc3d4b6f21b", // LOBSTR
];

if (WC_PROJECT_ID) {
  modules.unshift(
    new WalletConnectModule({
      projectId: WC_PROJECT_ID,
      metadata: {
        name: "Prism",
        description: "The wallet your AI agent can't drain",
        url: "https://prism-stellar.vercel.app",
        icons: ["https://prism-stellar.vercel.app/apple-touch-icon.png"],
      },
      allowedChains: [WalletConnectTargetChain.TESTNET],
      appKitOptions: {
        includeWalletIds: STELLAR_WC_WALLETS,
      } as WalletConnectModuleParams["appKitOptions"],
    }),
  );
}

// One-time kit setup. `authModal()` lists these as the available "wallet options".
// The default selection must be a module that is actually loaded — naming an absent one
// throws ("Wallet id … is not an existing module") and the app never renders.
const defaultWalletId = modules.some((m) => m.productId === FREIGHTER_ID)
  ? FREIGHTER_ID
  : WC_PROJECT_ID
    ? WALLET_CONNECT_ID
    : ALBEDO_ID;

StellarWalletsKit.init({
  network: Networks.TESTNET,
  selectedWalletId: defaultWalletId,
  modules,
});

// Theme the wallet-select modal to match Prism — dark surface + Stellar-yellow accent.
StellarWalletsKit.setTheme({
  "background": "#0b0b10",
  "background-secondary": "#131319",
  "foreground-strong": "#f3f1ec",
  "foreground": "#e8e6df",
  "foreground-secondary": "#94939c",
  "primary": "#FDDA24",
  "primary-foreground": "#0F0F0F",
  "transparent": "transparent",
  "lighter": "rgba(255,255,255,0.08)",
  "light": "rgba(255,255,255,0.06)",
  "light-gray": "rgba(255,255,255,0.12)",
  "gray": "#56555f",
  "danger": "#FF4D5E",
  "border": "rgba(255,255,255,0.13)",
  "shadow": "rgba(0,0,0,0.6)",
  "border-radius": "16px",
  "font-family": "'Inter', system-ui, sans-serif",
});

export { StellarWalletsKit as kit };

const ADDR_KEY = "prism_wallet_address";
const WALLET_ID_KEY = "prism_wallet_id";
let connectedAddress: string | null =
  typeof sessionStorage !== "undefined" ? sessionStorage.getItem(ADDR_KEY) : null;

// Reload persistence for the SELECTED MODULE, not just the address: the kit routes
// `signTransaction` through its selected module, and `init` above resets that selection
// to Freighter on every page load. Without restoring it, a reconnected xBull / Lobstr /
// WalletConnect session would look connected (address survives) but sign through the
// wrong wallet. Restore is best-effort — an unavailable module (e.g. the WalletConnect
// env var was removed) just leaves the Freighter default.
const savedWalletId =
  typeof sessionStorage !== "undefined" ? sessionStorage.getItem(WALLET_ID_KEY) : null;
if (savedWalletId && savedWalletId !== FREIGHTER_ID && connectedAddress) {
  (async () => {
    try {
      await StellarWalletsKit.setWallet(savedWalletId);
    } catch {
      /* module unavailable — Freighter default stands */
    }
  })();
}

// The nav chip and the views all reflect one connection — notify them on change.
type AddressListener = (address: string | null) => void;
const addressListeners = new Set<AddressListener>();
function notifyAddress(): void {
  for (const fn of addressListeners) fn(connectedAddress);
}

/** Subscribe to connect/disconnect changes. Returns an unsubscribe function. */
export function onAddressChange(fn: AddressListener): () => void {
  addressListeners.add(fn);
  return () => {
    addressListeners.delete(fn);
  };
}

/** The currently connected wallet address (persisted across reloads in this tab), or null. */
export function getAddress(): string | null {
  return connectedAddress;
}

/** Open the wallet-select modal and return the chosen address. Throws if none selected.
 *  Funnel-instrumented: a `connect_click` on open, then a `connect_result` — success (a
 *  wallet bound), error (modal rejected, e.g. no compatible wallet / user aborted), or
 *  dismissed (resolved with no wallet). This is what makes the connect-wall drop-off visible. */
export async function connect(): Promise<string> {
  logFunnel({ event: "connect_click" });
  let address: string | undefined;
  try {
    const res = await StellarWalletsKit.authModal();
    address = (res as { address?: string }).address;
    if (address) {
      connectedAddress = address;
      sessionStorage.setItem(ADDR_KEY, address);
      const walletId = (res as { walletId?: string }).walletId;
      if (walletId) sessionStorage.setItem(WALLET_ID_KEY, walletId); // survive reloads (see above)
      notifyAddress();
      logFunnel({ event: "connect_result", outcome: "success", walletId });
      return address;
    }
  } catch (e) {
    logFunnel({
      event: "connect_result",
      outcome: "error",
      detail: errText(e), // SDK rejects with a plain object; String(e) would be "[object Object]"
    });
    throw e;
  }
  logFunnel({ event: "connect_result", outcome: "dismissed" });
  throw new Error("No wallet selected.");
}

export async function disconnect(): Promise<void> {
  try {
    await StellarWalletsKit.disconnect();
  } catch {
    /* ignore */
  }
  connectedAddress = null;
  sessionStorage.removeItem(ADDR_KEY);
  sessionStorage.removeItem(WALLET_ID_KEY);
  notifyAddress();
}

/** A contract-client `signTransaction` bound to the connected wallet. A session the wallet
 *  has already dropped is cleared here, so the chip falls back to "Connect wallet" rather
 *  than leaving the user tapping actions that never reach a wallet. */
export function walletSignerFor(address: string): ContractSigner {
  return makeWalletSigner(StellarWalletsKit, address, NETWORK_PASSPHRASE, () => void disconnect());
}
