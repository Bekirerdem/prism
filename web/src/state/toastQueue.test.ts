import { describe, expect, it } from "vitest";
import { dismissDelay, dismissToast, pushToast, type ToastItem } from "./toastQueue";

const t = (id: number): ToastItem => ({ id, kind: "info", msg: `m${id}` });

describe("pushToast", () => {
  it("appends with the given id", () => {
    const out = pushToast([], { kind: "success", msg: "ok", hash: "h" }, 1);
    expect(out).toEqual([{ id: 1, kind: "success", msg: "ok", hash: "h" }]);
  });

  it("drops the oldest beyond the cap", () => {
    let list: ToastItem[] = [];
    for (let i = 1; i <= 6; i++) list = pushToast(list, { kind: "info", msg: `m${i}` }, i);
    expect(list.map((x) => x.id)).toEqual([3, 4, 5, 6]);
  });

  // A wallet that keeps failing pushed the same error once per retry; on a phone the
  // stack covered the controls underneath it (reported 2026-07-28).
  it("replaces a repeat of the same message instead of stacking it", () => {
    const first = pushToast([], { kind: "error", msg: "same" }, 1);
    const again = pushToast(first, { kind: "error", msg: "same" }, 2);
    expect(again).toEqual([{ id: 2, kind: "error", msg: "same", hash: undefined }]);
  });

  it("keeps the same message when the kind differs", () => {
    const list = pushToast(pushToast([], { kind: "info", msg: "x" }, 1), { kind: "error", msg: "x" }, 2);
    expect(list.map((t) => t.id)).toEqual([1, 2]);
  });

  it("honours a tighter cap for small screens", () => {
    let list: ToastItem[] = [];
    for (let i = 1; i <= 4; i++) list = pushToast(list, { kind: "info", msg: `m${i}` }, i, 2);
    expect(list.map((x) => x.id)).toEqual([3, 4]);
  });
});

describe("dismissDelay", () => {
  it("clears progress and success toasts quickly", () => {
    expect(dismissDelay("info")).toBe(5000);
    expect(dismissDelay("success")).toBe(5000);
  });

  // Errors used to stay forever: `if (kind !== "error")` skipped the timer entirely, so
  // every failure stayed on screen with pointer-events on top of the page.
  it("keeps errors readable for longer but still clears them", () => {
    expect(dismissDelay("error")).toBe(12000);
  });
});

describe("dismissToast", () => {
  it("removes only the matching id", () => {
    expect(dismissToast([t(1), t(2)], 1).map((x) => x.id)).toEqual([2]);
    expect(dismissToast([t(1)], 99)).toHaveLength(1);
  });
});
