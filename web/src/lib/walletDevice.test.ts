import { describe, expect, it } from "vitest";
import { classifyWalletForDevice, sortWalletsForDevice } from "./walletDevice";

describe("classifyWalletForDevice", () => {
  it("treats desktop-only wallets as unavailable on mobile", () => {
    expect(classifyWalletForDevice("mobile", { id: "freighter", desktopOnly: true })).toBe("desktop-only");
    expect(classifyWalletForDevice("desktop", { id: "freighter", desktopOnly: true })).toBe("available");
  });

  it("keeps non-desktop-only wallets available on mobile", () => {
    expect(classifyWalletForDevice("mobile", { id: "wallet_connect" })).toBe("available");
  });
});

describe("sortWalletsForDevice", () => {
  it("puts WalletConnect first on mobile and removes desktop-only wallets", () => {
    const wallets = [
      { id: "wallet_connect" },
      { id: "freighter", desktopOnly: true },
      { id: "xbull", desktopOnly: true },
      { id: "albedo" },
    ];

    expect(sortWalletsForDevice("mobile", wallets).map((wallet) => wallet.id)).toEqual([
      "wallet_connect",
      "albedo",
    ]);
  });

  it("leaves the desktop ordering unchanged", () => {
    const wallets = [
      { id: "wallet_connect" },
      { id: "freighter", desktopOnly: true },
      { id: "albedo" },
    ];

    expect(sortWalletsForDevice("desktop", wallets).map((wallet) => wallet.id)).toEqual([
      "wallet_connect",
      "freighter",
      "albedo",
    ]);
  });
});
