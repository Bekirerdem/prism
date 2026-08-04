import { describe, it, expect } from "vitest";
import { amountFromLabel, decisionsByDay, spendByDay, weekTotals } from "./insights";
import type { FeedEvent } from "./events";

const NOW = new Date("2026-08-04T15:00:00");
const at = (daysAgo: number, hour = 12) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const ev = (kind: string, daysAgo: number, label = "", hour = 12): FeedEvent =>
  ({ id: `${kind}-${daysAgo}-${hour}`, kind, label, at: at(daysAgo, hour) }) as FeedEvent;

describe("decisionsByDay", () => {
  it("keeps empty days so the week's spacing stays honest", () => {
    const buckets = decisionsByDay([ev("paid", 0)], 7, NOW);
    expect(buckets).toHaveLength(7);
    expect(buckets.filter((b) => b.allowed === 0 && b.blocked === 0)).toHaveLength(6);
  });

  it("counts allowed and blocked separately, oldest day first", () => {
    const buckets = decisionsByDay(
      [ev("paid", 2), ev("blocked", 2), ev("blocked", 2), ev("paid", 0)],
      7,
      NOW,
    );
    expect(buckets[4]).toMatchObject({ allowed: 1, blocked: 2 });
    expect(buckets[6]).toMatchObject({ allowed: 1, blocked: 0 });
  });

  it("ignores events older than the window and kinds that are not payment decisions", () => {
    const buckets = decisionsByDay([ev("paid", 30), ev("fund", 0), ev("whitelist", 0)], 7, NOW);
    expect(weekTotals(buckets)).toEqual({ allowed: 0, blocked: 0 });
  });

  it("buckets by local calendar day, not UTC", () => {
    // 23:30 local on the most recent day. Under toISOString() east of UTC this lands on
    // tomorrow and falls out of the window entirely.
    const buckets = decisionsByDay([ev("paid", 0, "", 23)], 7, NOW);
    expect(buckets[6].allowed).toBe(1);
  });
});

describe("amountFromLabel", () => {
  it("reads the amount out of a payment label", () => {
    expect(amountFromLabel("Payment from CBBU…PGFU's treasury · 10 XLM")).toBe(10);
    expect(amountFromLabel("CBBU…PGFU funded a treasury · 1,250.5 XLM")).toBe(1250.5);
  });

  it("returns null when there is no amount to read", () => {
    expect(amountFromLabel("CBBU…PGFU approved a payee")).toBeNull();
    expect(amountFromLabel("")).toBeNull();
  });
});

describe("spendByDay", () => {
  it("sums only what actually left the treasury", () => {
    const spend = spendByDay(
      [
        ev("paid", 1, "Payment · 10 XLM"),
        ev("paid", 1, "Payment · 5 XLM", 15),
        ev("blocked", 1, "Blocked · 100 XLM"),
        ev("fund", 1, "Funded · 500 XLM"),
      ],
      7,
      NOW,
    );
    expect(spend[5]).toBe(15);
    expect(spend.filter((v) => v > 0)).toHaveLength(1);
  });
});
