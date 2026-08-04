// What the dashboard's charts are made of. Everything here is derived from the same event
// feed the activity list renders, so a number on a chart and a row in the list can never
// disagree — and nothing is invented to fill a panel.
import type { FeedEvent } from "./events";

export interface DayBucket {
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  /** Short weekday label for the axis. */
  label: string;
  allowed: number;
  blocked: number;
}

const DAY_MS = 86_400_000;
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Local YYYY-MM-DD — not toISOString(), which shifts the day for anyone east or west of UTC
 *  and would put an evening payment on tomorrow's bar. */
function dayKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Payment decisions per day for the last `days` days, oldest first. Days with nothing in
 *  them are kept: a gap in the week is information, and dropping them would make the bars
 *  lie about spacing. */
export function decisionsByDay(events: FeedEvent[], days = 7, now = new Date()): DayBucket[] {
  const buckets = new Map<string, DayBucket>();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS);
    buckets.set(dayKey(d), {
      day: dayKey(d),
      label: WEEKDAY[d.getDay()],
      allowed: 0,
      blocked: 0,
    });
  }

  for (const e of events) {
    const t = Date.parse(e.at);
    if (Number.isNaN(t)) continue;
    const bucket = buckets.get(dayKey(new Date(t)));
    if (!bucket) continue; // older than the window
    if (e.kind === "blocked") bucket.blocked += 1;
    else if (e.kind === "paid") bucket.allowed += 1;
  }

  return [...buckets.values()];
}

/** Totals across the same window, for the line under the chart. */
export function weekTotals(buckets: DayBucket[]): { allowed: number; blocked: number } {
  return buckets.reduce(
    (acc, b) => ({ allowed: acc.allowed + b.allowed, blocked: acc.blocked + b.blocked }),
    { allowed: 0, blocked: 0 },
  );
}

/** The amount attached to an event label, in XLM, or null when there isn't one.
 *  Labels read like "Payment from CBBU…PGFU's treasury · 10 XLM". */
export function amountFromLabel(label: string): number | null {
  const m = /·\s*([\d.,]+)\s*XLM/i.exec(label);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Spend per day over the window — the shape of the sparkline beside the balance. */
export function spendByDay(events: FeedEvent[], days = 7, now = new Date()): number[] {
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    buckets.set(dayKey(new Date(now.getTime() - i * DAY_MS)), 0);
  }

  for (const e of events) {
    if (e.kind !== "paid") continue;
    const t = Date.parse(e.at);
    if (Number.isNaN(t)) continue;
    const key = dayKey(new Date(t));
    if (!buckets.has(key)) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + (amountFromLabel(e.label) ?? 0));
  }

  return [...buckets.values()];
}
