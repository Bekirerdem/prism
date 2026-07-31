// Live viewport classification for UI branching (the fund bottom-sheet). Mirrors the
// 1023px breakpoint the input font-size media query uses — keep the two in sync.
import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 1023px)";

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
