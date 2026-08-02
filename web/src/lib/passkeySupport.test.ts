import { describe, it, expect } from "vitest";
import { passkeyCapability } from "./passkeySupport";

const withProbe = (probe: () => Promise<boolean>) => ({
  PublicKeyCredential: { isUserVerifyingPlatformAuthenticatorAvailable: probe },
});

describe("passkeyCapability", () => {
  it("reports platform when the device has a built-in authenticator", async () => {
    // Windows Hello, Touch ID — the one-tap case.
    await expect(passkeyCapability(withProbe(() => Promise.resolve(true)))).resolves.toBe("platform");
  });

  it("reports cross-device when WebAuthn exists but nothing is built in", async () => {
    // Still usable: the browser offers phone pairing over QR, or a password manager.
    await expect(passkeyCapability(withProbe(() => Promise.resolve(false)))).resolves.toBe("cross-device");
  });

  it("reports none when the browser has no WebAuthn at all", async () => {
    await expect(passkeyCapability({})).resolves.toBe("none");
  });

  it("reports none when PublicKeyCredential exists without the probe method", async () => {
    await expect(passkeyCapability({ PublicKeyCredential: {} })).resolves.toBe("none");
  });

  it("degrades to cross-device when the probe throws rather than hiding the option", async () => {
    // WebAuthn is there; only the convenience probe failed. Hiding the CTA would cost a user
    // who could have paired their phone.
    await expect(passkeyCapability(withProbe(() => Promise.reject(new Error("boom"))))).resolves.toBe(
      "cross-device",
    );
  });
});
