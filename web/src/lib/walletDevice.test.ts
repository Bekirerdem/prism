import { describe, expect, it } from "vitest";
import { FREIGHTER_ID } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { XBULL_ID } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { ALBEDO_ID } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { WALLET_CONNECT_ID } from "@creit.tech/stellar-wallets-kit/modules/wallet-connect";
import {
  classifyWalletForDevice,
  desktopOnlyWalletIds,
  sortWalletsForDevice,
} from "./walletDevice";

// All assertions run against the real desktopOnlyWalletIds set and the kit's real ID
// constants — no hand-built literals, so a drifted id fails here instead of in prod.

describe("desktopOnlyWalletIds", () => {
  it("lists the extension wallets but not web-based Albedo or WalletConnect", () => {
    expect(desktopOnlyWalletIds.has(FREIGHTER_ID)).toBe(true);
    expect(desktopOnlyWalletIds.has(XBULL_ID)).toBe(true);
    expect(desktopOnlyWalletIds.has(ALBEDO_ID)).toBe(false);
    expect(desktopOnlyWalletIds.has(WALLET_CONNECT_ID)).toBe(false);
  });
});

describe("classifyWalletForDevice", () => {
  it("treats extension-only wallets as desktop-only on mobile", () => {
    expect(classifyWalletForDevice("mobile", FREIGHTER_ID)).toBe("desktop-only");
    expect(classifyWalletForDevice("desktop", FREIGHTER_ID)).toBe("available");
  });

  it("keeps WalletConnect and web-based Albedo available on mobile", () => {
    expect(classifyWalletForDevice("mobile", WALLET_CONNECT_ID)).toBe("available");
    expect(classifyWalletForDevice("mobile", ALBEDO_ID)).toBe("available");
  });
});

describe("sortWalletsForDevice", () => {
  const wallets = [
    { id: FREIGHTER_ID },
    { id: XBULL_ID },
    { id: ALBEDO_ID },
    { id: WALLET_CONNECT_ID },
  ];

  it("puts WalletConnect first on mobile and removes extension-only wallets", () => {
    expect(sortWalletsForDevice("mobile", wallets).map((wallet) => wallet.id)).toEqual([
      WALLET_CONNECT_ID,
      ALBEDO_ID,
    ]);
  });

  it("leaves the desktop list unchanged", () => {
    expect(sortWalletsForDevice("desktop", wallets).map((wallet) => wallet.id)).toEqual([
      FREIGHTER_ID,
      XBULL_ID,
      ALBEDO_ID,
      WALLET_CONNECT_ID,
    ]);
  });
});
