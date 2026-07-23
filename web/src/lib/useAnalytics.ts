// The analytics data engine, extracted from the old Analytics panel so both the Demo
// panel and the shell's Overview read the same numbers. Behaviour is unchanged: seed
// from the persistent event ledger, continue from the cached paging cursor when
// possible, otherwise cold-load the whole retained history head-based.
import { useEffect, useRef, useState } from "react";
import { rpc } from "@stellar/stellar-sdk";
import { RPC_URL } from "../config";
import { dedupeById, fetchAllEvents, type FeedEvent } from "./events";
import {
  agentScorecard,
  getMonitor,
  spendSeries,
  type MonitorState,
  type Scorecard,
  type SpendPoint,
} from "./analytics";
import { loadLedger, recordEvents } from "./eventLedger";

export interface AnalyticsData {
  events: FeedEvent[];
  score: Scorecard;
  series: SpendPoint[];
  monitor: MonitorState;
  status: "loading" | "ready" | "error";
  truncated: boolean;
  refresh: () => void;
}

export function useAnalyticsScore(contractId: string, refreshKey = 0): AnalyticsData {
  // Seed from the persistent ledger so payments older than the RPC's event-retention
  // window (which a fresh scan can no longer see) never drop out of the counters.
  const [events, setEvents] = useState<FeedEvent[]>(() => loadLedger(contractId));
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [truncated, setTruncated] = useState(false);
  const [tick, setTick] = useState(0);
  // Last read's paging cursor + events, so a refresh continues from where the previous
  // read stopped (typically one RPC round-trip) instead of re-scanning all history.
  const cacheRef = useRef<{ contractId: string; cursor: string; events: FeedEvent[] } | null>(null);

  // Re-fetch on contract change, after a parent action (refreshKey), or manual refresh.
  // RPC indexes a new payment a few seconds after it lands, so the manual refresh covers
  // the lag where an auto-refresh fires before the event is queryable.
  useEffect(() => {
    let alive = true;
    setStatus("loading");
    setEvents(loadLedger(contractId)); // instant paint from the ledger while the scan runs
    (async () => {
      const server = new rpc.Server(RPC_URL);

      // Incremental: continue from the cached cursor.
      const cached = cacheRef.current;
      if (cached?.contractId === contractId && cached.cursor) {
        try {
          const page = await fetchAllEvents(server, { contractIds: [contractId], cursor: cached.cursor });
          const merged = dedupeById([...cached.events, ...page.events]);
          cacheRef.current = { contractId, cursor: page.cursor || cached.cursor, events: merged };
          if (page.truncated) console.warn("Analytics: event history truncated at the page cap — totals may be partial.");
          if (alive) {
            setEvents(recordEvents(contractId, merged));
            setTruncated(page.truncated);
            setStatus("ready");
          }
          return;
        } catch {
          cacheRef.current = null; // stale/expired cursor — fall back to a cold load
        }
      }

      try {
        // Cold load: the treasury's WHOLE retained history, not a half-day window —
        // otherwise a user returning a day later sees zeroed analytics. Start at the
        // RPC's oldest retained ledger and page to the chain head (head-based stop,
        // so the NEWEST events are never dropped).
        let start = 1;
        try {
          const health = await server.getHealth();
          start = Math.max(1, (health.oldestLedger ?? 1) + 1);
        } catch {
          const latest = await server.getLatestLedger();
          start = Math.max(1, latest.sequence - 9000);
        }
        const page = await fetchAllEvents(server, { contractIds: [contractId], startLedger: start });
        cacheRef.current = { contractId, cursor: page.cursor, events: page.events };
        if (page.truncated) console.warn("Analytics: event history truncated at the page cap — totals may be partial.");
        if (alive) {
          setEvents(recordEvents(contractId, page.events));
          setTruncated(page.truncated);
          setStatus("ready");
        }
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [contractId, refreshKey, tick]);

  return {
    events,
    score: agentScorecard(events),
    series: spendSeries(events),
    monitor: getMonitor(contractId),
    status,
    truncated,
    refresh: () => setTick((t) => t + 1),
  };
}
