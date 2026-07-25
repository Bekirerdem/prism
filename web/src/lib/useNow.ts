import { useSyncExternalStore } from "react";

function subscribeTick(onStoreChange: () => void): () => void {
  const id = setInterval(onStoreChange, 1000);
  return () => clearInterval(id);
}

function getNow(): number {
  return Date.now();
}

/** Millisecond clock that ticks once per second while `enabled` — no setState in effects. */
export function useNow(enabled: boolean): number {
  return useSyncExternalStore(
    (onStoreChange) => (enabled ? subscribeTick(onStoreChange) : () => {}),
    getNow,
    getNow,
  );
}
