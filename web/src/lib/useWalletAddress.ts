import { useSyncExternalStore } from "react";
import { getAddress, onAddressChange } from "./walletKit";

/** Wallet address from the shared kit store — updates on connect/disconnect without an effect. */
export function useWalletAddress(): string | null {
  return useSyncExternalStore(onAddressChange, getAddress, () => null);
}
