import { describe, expect, it } from "vitest";
import { toastStyles } from "./toastStyles";

// A WalletConnect session topic is 64 unbroken hex characters. Rendered in a flex item
// with the default `min-width: auto`, it pushed the toast past the viewport and the phone
// browser zoomed the whole page out (reported 2026-07-28). The message must wrap instead.
describe("toast message style", () => {
  it("lets the message shrink below its content width", () => {
    expect(toastStyles.msg.minWidth).toBe(0);
  });

  it("breaks unbroken strings like a session topic or contract id", () => {
    expect(toastStyles.msg.overflowWrap).toBe("anywhere");
  });

  it("never lets a toast grow wider than the stack", () => {
    expect(toastStyles.box.maxWidth).toBe("100%");
  });
});
