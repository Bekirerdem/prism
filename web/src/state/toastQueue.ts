// Pure toast queue: the provider renders whatever this produces, so capping and
// dismissal rules stay unit-testable without touching React.
export type ToastKind = "info" | "success" | "error";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  msg: string;
  hash?: string;
}

/** Append a toast, dropping the oldest once over `cap` (default 4). A repeat of a toast
 *  already on screen replaces it rather than stacking: a retrying wallet call otherwise
 *  filled the stack with the same error and covered the controls beneath it. */
export function pushToast(
  list: ToastItem[],
  t: Omit<ToastItem, "id">,
  id: number,
  cap = 4,
): ToastItem[] {
  const next = [...list.filter((x) => !(x.kind === t.kind && x.msg === t.msg)), { ...t, id }];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** How long a toast stays before it dismisses itself. Errors linger long enough to read,
 *  but they do dismiss — leaving them up forever buried the page under them on a phone. */
export function dismissDelay(kind: ToastKind): number {
  return kind === "error" ? 12000 : 5000;
}

export function dismissToast(list: ToastItem[], id: number): ToastItem[] {
  return list.filter((t) => t.id !== id);
}
