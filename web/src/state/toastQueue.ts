// Pure toast queue: the provider renders whatever this produces, so capping and
// dismissal rules stay unit-testable without touching React.
export type ToastKind = "info" | "success" | "error";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  msg: string;
  hash?: string;
}

/** Append a toast, dropping the oldest once over `cap` (default 4). */
export function pushToast(
  list: ToastItem[],
  t: Omit<ToastItem, "id">,
  id: number,
  cap = 4,
): ToastItem[] {
  const next = [...list, { ...t, id }];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

export function dismissToast(list: ToastItem[], id: number): ToastItem[] {
  return list.filter((t) => t.id !== id);
}
