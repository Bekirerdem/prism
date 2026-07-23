// Context + hook live apart from the provider component so toast.tsx exports only a
// component (react-refresh/only-export-components keeps fast refresh intact).
import { createContext, useContext } from "react";
import type { ToastKind } from "./toastQueue";

export interface ToastApi {
  toast: (kind: ToastKind, msg: string, opts?: { hash?: string }) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
