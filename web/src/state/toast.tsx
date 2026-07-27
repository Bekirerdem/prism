// App-wide toast surface: tx progress/results appear top-right under the topbar, so a
// success in one page is visible from anywhere. Validation errors do NOT come here —
// they render inline next to the form that caused them (ActionOutcome.validation).
import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EXPLORER } from "../config";
import { ToastContext } from "./toastContext";
import { dismissToast, pushToast, type ToastItem, type ToastKind } from "./toastQueue";

const AUTO_DISMISS_MS = 5000; // success/info; errors stay until dismissed

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => dismissToast(list, id));
  }, []);

  const toast = useCallback(
    (kind: ToastKind, msg: string, opts?: { hash?: string }) => {
      const id = nextId.current++;
      setItems((list) => pushToast(list, { kind, msg, hash: opts?.hash }, id));
      if (kind !== "error") setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={stack} aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              data-toast-kind={t.kind}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              style={{ ...box, borderColor: color(t.kind) + "55", color: color(t.kind) }}
            >
              <span style={{ flex: 1 }}>{t.msg}</span>
              {t.hash && (
                <a
                  style={{ color: color(t.kind), whiteSpace: "nowrap" }}
                  href={`${EXPLORER}/tx/${t.hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  view tx ↗
                </a>
              )}
              <button style={closeBtn} onClick={() => dismiss(t.id)} type="button" aria-label="Dismiss">
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

const color = (k: ToastKind) => (k === "success" ? "#00FF43" : k === "error" ? "#FF5D5D" : "#A0A0B8");

const stack: React.CSSProperties = {
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
const box: React.CSSProperties = {
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
};
const closeBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  fontSize: 12,
  padding: 0,
  opacity: 0.7,
};
