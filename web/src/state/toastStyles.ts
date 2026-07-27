// Toast presentation, kept out of the provider so the overflow guards below stay testable
// (and so the component file only exports a component).
import type { CSSProperties } from "react";
import type { ToastKind } from "./toastQueue";

export const toastColor = (k: ToastKind) =>
  k === "success" ? "#00FF43" : k === "error" ? "#FF5D5D" : "#A0A0B8";

const stack: CSSProperties = {
  position: "fixed",
  top: 64,
  right: 16,
  zIndex: 2000,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  width: "min(360px, calc(100vw - 32px))",
  pointerEvents: "none",
};
const box: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: "10px 13px",
  borderRadius: 10,
  border: "1px solid",
  background: "rgba(18,18,28,0.92)",
  backdropFilter: "blur(8px)",
  fontSize: 13.5,
  lineHeight: 1.4,
  pointerEvents: "auto",
  maxWidth: "100%",
};
// A flex item defaults to `min-width: auto`, so an unbroken string (a 64-char WalletConnect
// session topic, a contract id) widens the toast past the viewport and phones zoom the page
// out to fit it. Shrink-to-fit + break anywhere keeps the message inside the stack.
const msg: CSSProperties = { flex: 1, minWidth: 0, overflowWrap: "anywhere" };
const closeBtn: CSSProperties = {
  background: "none",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  fontSize: 12,
  padding: 0,
  opacity: 0.7,
};

export const toastStyles = { stack, box, msg, closeBtn };
