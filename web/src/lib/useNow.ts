import { useSyncExternalStore } from "react";

// `getSnapshot` MUST return a stable value between ticks: React calls it on every render and
// compares the result with Object.is. A fresh `Date.now()` never settles, so React warns
// "The result of getSnapshot should be cached to avoid an infinite loop" and re-renders in a
// loop. Keep the clock in module scope and advance it only when the interval fires.
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

// `subscribe` must be a stable reference too — a fresh closure per render makes React
// unsubscribe and resubscribe every time, restarting the interval before it can ever fire.
function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  if (timer === null) {
    now = Date.now(); // first subscriber: don't hand out a reading left over from an earlier mount
    timer = setInterval(() => {
      now = Date.now();
      for (const listener of listeners) listener();
    }, 1000);
  }
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function noSubscribe(): () => void {
  return () => {};
}

function getSnapshot(): number {
  return now;
}

/** Millisecond clock that ticks once per second while `enabled` — no setState in effects. */
export function useNow(enabled: boolean): number {
  return useSyncExternalStore(enabled ? subscribe : noSubscribe, getSnapshot, getSnapshot);
}
