// What the browser can offer, decided once at load.
//
// We never pick the authenticator ourselves: pressing the passkey button hands off to the
// operating system, which offers whatever that device has — Windows Hello, Touch ID, a phone
// over QR, a password manager, a security key. So there is no mobile-vs-desktop branch here,
// only "is there anything at all, and is it built in".

export type PasskeyCapability = "platform" | "cross-device" | "none";

interface WebAuthnWindow {
  PublicKeyCredential?: {
    isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
  };
}

/** Whether to show the passkey CTA, and which hint belongs under it.
 *  `platform` — built-in authenticator (fingerprint / face / PIN).
 *  `cross-device` — no built-in one, but the browser can still pair a phone or manager.
 *  `none` — no WebAuthn; the CTA is hidden and the wallet path stands. */
export async function passkeyCapability(win: WebAuthnWindow): Promise<PasskeyCapability> {
  const probe = win.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable;
  if (!probe) return "none";
  try {
    return (await probe()) ? "platform" : "cross-device";
  } catch {
    // The probe is a convenience, not a gate — WebAuthn itself is still there.
    return "cross-device";
  }
}
