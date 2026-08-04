// Activity — the platform's full, live ledger. Three layers merged by tx hash:
// (1) full history from Supabase `activity` (the RPC forgets old events; this doesn't),
// (2) a Realtime INSERT subscription so any user's action lands here the second it's
// logged, (3) the original Soroban RPC cursor-poll for richer on-chain event labels.
import { useEffect, useMemo, useState } from "react";
import { rpc } from "@stellar/stellar-sdk";
import { EXPLORER, RPC_URL, TREASURY_ID, VERIFIER_ID } from "../config";
import { dedupeById, fetchAllEvents, fetchEventsPage, type FeedEvent } from "../lib/events";
import { fetchActivityHistory, mergeFeedEvents, subscribeActivity } from "../lib/activity";
import { filterFeed, type FeedFilter } from "../lib/feedFilter";
import { getTreasuryId } from "../lib/treasuryStore";
import { useWalletAddress } from "../lib/useWalletAddress";

const POLL_MS = 6000; // ~1 testnet ledger
const MAX_ITEMS = 120;
const PAGE = 30; // rows revealed per "Load more"

export default function ActivityFeed({ filter }: { filter?: FeedFilter }) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [state, setState] = useState<"connecting" | "live" | "error">("connecting");
  const [visible, setVisible] = useState(PAGE);

  // Watch the connected user's own treasury alongside the demo treasury + verifier —
  // otherwise a user's payments never show up here and the feed looks broken.
  const address = useWalletAddress();
  const myTreasury = address ? getTreasuryId(address) : null;

  const contractIds = useMemo(
    () => (myTreasury ? [TREASURY_ID, VERIFIER_ID, myTreasury] : [TREASURY_ID, VERIFIER_ID]),
    [myTreasury],
  );

  useEffect(() => {
    const server = new rpc.Server(RPC_URL);
    let cursor = "";
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (stopped) return;
      try {
        const page = await fetchEventsPage(server, cursor ? { cursor, contractIds } : ({ contractIds } as never));
        if (page.events.length) {
          setEvents((prev) => mergeFeedEvents(dedupeById(page.events), prev, MAX_ITEMS));
        }
        if (page.cursor) cursor = page.cursor;
      } catch {
        /* transient RPC hiccup — keep polling */
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };

    const bootstrap = async () => {
      if (stopped) return;
      // Full platform history first — it doesn't depend on the RPC, so the feed paints
      // even when the RPC is down or the chain window has long forgotten the events.
      const history = await fetchActivityHistory(MAX_ITEMS);
      if (stopped) return;
      if (history.length) setEvents((prev) => mergeFeedEvents(prev, history, MAX_ITEMS));
      try {
        const latest = await server.getLatestLedger();
        const start = Math.max(1, latest.sequence - 17280); // RPC layer: ~last day, for richer labels
        // getEvents scans ~10k ledgers per call, so a day-wide window spans multiple
        // pages — page through to the head up front (head-based stop), or the newest
        // events (past the first, often empty, page) never render and the feed looks dead.
        const { events: all, cursor: c } = await fetchAllEvents(server, { startLedger: start, contractIds });
        if (stopped) return;
        setEvents((prev) => mergeFeedEvents(dedupeById(all), prev, MAX_ITEMS));
        cursor = c;
        setState("live");
        timer = setTimeout(tick, POLL_MS);
      } catch {
        // `tick` only ever starts after a successful bootstrap, so a failed one must
        // reschedule itself — otherwise the live layer stays dead for the whole session.
        setState(history.length ? "live" : "error");
        if (!stopped) timer = setTimeout(bootstrap, POLL_MS);
      }
    };

    bootstrap();

    // Realtime: any user's logged action lands here the moment it's inserted.
    const unsubscribe = subscribeActivity((e) => {
      if (!stopped) setEvents((prev) => mergeFeedEvents(prev, [e], MAX_ITEMS));
    });

    return () => {
      stopped = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [contractIds]);

  // View-level filter + paging: merge/poll state above stays untouched, so switching
  // chips never refetches — it just re-slices what's already in memory.
  const shown = useMemo(() => {
    const list = filter ? filterFeed(events, filter) : events;
    return { list: list.slice(0, visible), total: list.length };
  }, [events, filter, visible]);

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, fontSize: 24, letterSpacing: "-0.02em" }}>◭ Activity</h1>
        <span style={dot(state)}>
          {state === "live" ? "● live" : state === "connecting" ? "○ connecting" : "○ offline"}
        </span>
      </div>
      <p style={{ color: "var(--ink-2)", marginTop: 6, fontSize: 14 }}>
        Every treasury action across Eunomia — full history, streamed live. On-chain events
        from the demo treasury, the ZK verifier and your own treasury ride on top.
      </p>

      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.list.length === 0 ? (
          <div style={{ color: "var(--ink-2)", fontSize: 14, padding: "20px 0" }}>
            {state === "error"
              ? "Couldn't reach the network — retrying…"
              : state === "connecting"
                ? "Loading platform activity…"
                : filter && events.length > 0
                  ? "Nothing matches these filters."
                  : "No activity yet — the first treasury action lands here live."}
          </div>
        ) : (
          shown.list.map((e) => {
            const inner = (
              <>
                <span style={kindTag(e.kind)}>{e.kind}</span>
                <span style={{ flex: 1, fontSize: 13.5 }}>{e.label}</span>
                <span style={{ color: "var(--ink-2)", fontSize: 11.5 }}>{timeAgo(e.at)}</span>
              </>
            );
            return e.txHash ? (
              <a key={e.id} style={item} href={`${EXPLORER}/tx/${e.txHash}`} target="_blank" rel="noreferrer">
                {inner}
              </a>
            ) : (
              <div key={e.id} style={item}>
                {inner}
              </div>
            );
          })
        )}
      </div>
      {shown.total > visible && (
        <button style={loadMore} onClick={() => setVisible((v) => v + PAGE)} type="button">
          Load more ({shown.total - shown.list.length} older)
        </button>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Shell-embedded: the AppShell provides page padding/centering; the card fills its slot.
const card: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: 24, borderRadius: 18,
  background: "var(--surface)", border: "1px solid var(--line)",
  color: "var(--ink)",
};
const loadMore: React.CSSProperties = {
  marginTop: 12, width: "100%", padding: "9px 14px", borderRadius: 10, cursor: "pointer",
  background: "transparent", border: "1px solid var(--line)", color: "var(--ink-2)",
  fontSize: 13, fontFamily: "inherit",
};
const item: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 11,
  background: "var(--line)", border: "1px solid var(--line)",
  color: "var(--ink)", textDecoration: "none",
};
// A tag per event kind used to mean six different hues. Only two of them ever carried
// information — a rejection and something the rules let through — so the rest are neutral
// now. Green is fill only (1.84:1 on cream), so a tag that fills with it writes in ink.
const ALLOWED: [string, string] = ["color-mix(in oklab, var(--green) 34%, transparent)", "var(--ink)"];
const NEUTRAL: [string, string] = ["var(--raise)", "var(--ink-2)"];
const KIND_COLORS: Record<string, [string, string]> = {
  blocked: ["color-mix(in oklab, var(--red) 14%, transparent)", "var(--red)"],
  paid: ALLOWED,
  fund: ALLOWED,
  deploy: ALLOWED,
  whitelist: ALLOWED,
};
const kindTag = (kind: string): React.CSSProperties => {
  const [bg, fg] = KIND_COLORS[kind] ?? NEUTRAL;
  return {
    fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700,
    padding: "3px 7px", borderRadius: 6, whiteSpace: "nowrap",
    background: bg, color: fg,
  };
};
const dot = (state: string): React.CSSProperties => ({
  fontSize: 12, fontWeight: 600,
  color: state === "live" ? "var(--ink)" : state === "error" ? "var(--red)" : "var(--ink-2)",
});
