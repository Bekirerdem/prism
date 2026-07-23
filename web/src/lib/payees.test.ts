import { beforeEach, describe, expect, it } from "vitest";
import type { FeedEvent } from "./events";
import {
  forgetPayee,
  loadPayeeBook,
  mergePayees,
  payeesFromEvents,
  rememberPayee,
} from "./payees";

const ev = (id: string, kind: "payee_add" | "payee_rm", payee: string, at = "2026-07-20T00:00:00Z"): FeedEvent => ({
  id,
  kind,
  label: kind,
  txHash: "",
  at,
  payee,
});

describe("payeesFromEvents", () => {
  it("folds add events into the current whitelist", () => {
    const out = payeesFromEvents([ev("1-0", "payee_add", "GA"), ev("2-0", "payee_add", "GB")]);
    expect(out.map((p) => p.address)).toEqual(["GA", "GB"]);
    expect(out[0].source).toBe("chain");
  });

  it("removes a payee added earlier and lets a later add resurrect it", () => {
    const out = payeesFromEvents([
      ev("1-0", "payee_add", "GA"),
      ev("2-0", "payee_rm", "GA"),
      ev("3-0", "payee_add", "GB"),
    ]);
    expect(out.map((p) => p.address)).toEqual(["GB"]);
    const back = payeesFromEvents([
      ev("1-0", "payee_add", "GA"),
      ev("2-0", "payee_rm", "GA"),
      ev("3-0", "payee_add", "GA"),
    ]);
    expect(back.map((p) => p.address)).toEqual(["GA"]);
  });

  it("folds in event-id order even when the input arrives newest-first", () => {
    // Feeds are newest-first; TOID-style ids sort chronologically as bigints.
    const out = payeesFromEvents([
      ev("30-0", "payee_rm", "GA"),
      ev("10-0", "payee_add", "GA"),
      ev("20-0", "payee_add", "GB"),
    ]);
    expect(out.map((p) => p.address)).toEqual(["GB"]);
  });

  it("ignores events without a payee and records addedAt from the add event", () => {
    const out = payeesFromEvents([
      { id: "1", kind: "paid", label: "", txHash: "", at: "t" },
      ev("2-0", "payee_add", "GA", "2026-07-21T12:00:00Z"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].addedAt).toBe("2026-07-21T12:00:00Z");
  });
});

describe("mergePayees", () => {
  it("keeps chain entries and appends local-only ones as local", () => {
    const out = mergePayees([{ address: "GA", source: "chain" }], ["GA", "GB"]);
    expect(out).toEqual([
      { address: "GA", source: "chain" },
      { address: "GB", source: "local" },
    ]);
  });
});

describe("payee book (localStorage)", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k in store) delete store[k];
      },
      key: () => null,
      length: 0,
    } as Storage;
  });

  it("round-trips remember/load/forget per treasury", () => {
    rememberPayee("C1", "GA");
    rememberPayee("C1", "GB");
    rememberPayee("C1", "GA"); // idempotent
    rememberPayee("C2", "GC");
    expect(loadPayeeBook("C1")).toEqual(["GA", "GB"]);
    expect(loadPayeeBook("C2")).toEqual(["GC"]);
    forgetPayee("C1", "GA");
    expect(loadPayeeBook("C1")).toEqual(["GB"]);
    expect(loadPayeeBook("C3")).toEqual([]);
  });
});
