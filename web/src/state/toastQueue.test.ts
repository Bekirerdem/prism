import { describe, expect, it } from "vitest";
import { dismissToast, pushToast, type ToastItem } from "./toastQueue";

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
});

describe("dismissToast", () => {
  it("removes only the matching id", () => {
    expect(dismissToast([t(1), t(2)], 1).map((x) => x.id)).toEqual([2]);
    expect(dismissToast([t(1)], 99)).toHaveLength(1);
  });
});
