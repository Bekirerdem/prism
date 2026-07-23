// Durable per-treasury activity: Supabase history (survives RPC retention) + the
// Realtime INSERT stream, filtered to one treasury. Overview derives its counters
// (blocked, whitelist-ever, paid-ever) from this instead of device-local monitors —
// the numbers must not reset when the browser changes.
import { useEffect, useState } from "react";
import type { FeedEvent } from "./events";
import { fetchActivityHistory, mergeFeedEvents, subscribeActivity } from "./activity";
import { filterFeed } from "./feedFilter";

export function useTreasuryActivity(
  treasuryId: string,
  refreshKey: number,
): { rows: FeedEvent[]; freshId: string | null } {
  const [rows, setRows] = useState<FeedEvent[]>([]);
  const [freshId, setFreshId] = useState<string | null>(null); // just-arrived row (flash cue)

  useEffect(() => {
    let alive = true;
    (async () => {
      const hist = await fetchActivityHistory(120);
      if (alive) setRows(filterFeed(hist, { groups: null, treasuryId }));
    })();
    const unsub = subscribeActivity((e) => {
      const [mine] = filterFeed([e], { groups: null, treasuryId });
      if (!mine) return;
      setRows((list) => mergeFeedEvents([mine], list, 120));
      setFreshId(mine.id);
      setTimeout(() => setFreshId(null), 1200);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [treasuryId, refreshKey]);

  return { rows, freshId };
}
