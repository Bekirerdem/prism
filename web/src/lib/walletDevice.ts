import { WALLET_CONNECT_ID } from "@creit.tech/stellar-wallets-kit/modules/wallet-connect";
import type { Device } from "./funnel";

export interface WalletDeviceOption {
  id: string;
  desktopOnly?: boolean;
}

export type WalletDeviceAvailability = "available" | "desktop-only";

export function classifyWalletForDevice<T extends WalletDeviceOption>(
  device: Device,
  wallet: T,
): WalletDeviceAvailability {
  return device === "mobile" && wallet.desktopOnly ? "desktop-only" : "available";
}

/**
 * On mobile, surface WalletConnect first and hide desktop-only extensions that cannot be
 * used from a phone browser. Desktop keeps the full wallet list unchanged.
 */
export function sortWalletsForDevice<T extends WalletDeviceOption>(device: Device, wallets: T[]): T[] {
  const visibleWallets = wallets.filter(
    (wallet) => classifyWalletForDevice(device, wallet) === "available",
  );

  if (device !== "mobile") return visibleWallets;

  return [
    ...visibleWallets.filter((wallet) => wallet.id === WALLET_CONNECT_ID),
    ...visibleWallets.filter((wallet) => wallet.id !== WALLET_CONNECT_ID),
  ];
}
