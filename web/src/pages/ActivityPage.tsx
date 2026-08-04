// Activity page: the platform feed wrapped with view filters — kind-group chips and,
// when a treasury is open, a "my treasury only" toggle. Works without a wallet too
// (the platform feed is public social proof).
import { useMemo, useState } from "react";
import ActivityFeed from "../components/ActivityFeed";
import { KIND_GROUPS, type FeedFilter, type KindGroup } from "../lib/feedFilter";
import { useTreasury } from "../state/useTreasury";

const GROUP_LABEL: Record<KindGroup, string> = {
  payments: "Payments",
  blocked: "Blocked",
  fund: "Fund",
  deploy: "Create",
  whitelist: "Payees",
  leash: "Leash",
  lifecycle: "Lifecycle",
  zk: "ZK",
};

export default function ActivityPage() {
  const t = useTreasury();
  const [active, setActive] = useState<Set<KindGroup>>(new Set());
  const [mineOnly, setMineOnly] = useState(false);

  const toggle = (g: KindGroup) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const filter = useMemo<FeedFilter | undefined>(() => {
    const groups = active.size > 0 ? active : null;
    const treasuryId = mineOnly && t.treasuryId ? t.treasuryId : null;
    return groups || treasuryId ? { groups, treasuryId } : undefined;
  }, [active, mineOnly, t.treasuryId]);

  return (
    <div className="page">
      <div className="page__main">
        <ActivityFeed filter={filter} />
      </div>

      {/* Filters as a standing panel rather than a chip strip above the ledger: which slice
          you are looking at should be visible while you read it, not scrolled off. */}
      <div className="page__side">
        <div style={panel}>
          <div style={panelLabel}>Show</div>
          <div style={chipRow}>
            <button
              style={active.size === 0 ? chipActive : chip}
              onClick={() => setActive(new Set())}
              type="button"
            >
              All
            </button>
            {(Object.keys(KIND_GROUPS) as KindGroup[]).map((g) => (
              <button key={g} style={active.has(g) ? chipActive : chip} onClick={() => toggle(g)} type="button">
                {GROUP_LABEL[g]}
              </button>
            ))}
          </div>
          {t.treasuryId && (
            <button
              style={{ ...(mineOnly ? chipActive : chip), width: "100%", marginTop: 10 }}
              onClick={() => setMineOnly((m) => !m)}
              type="button"
            >
              ◇ my treasury only
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const panel: React.CSSProperties = {
  padding: 18, borderRadius: 16,
  background: "var(--surface)", border: "1px solid var(--line)",
};
const panelLabel: React.CSSProperties = {
  fontSize: 11, textTransform: "uppercase", letterSpacing: "0.09em",
  color: "var(--ink-2)", marginBottom: 12,
};
const chipRow: React.CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap" };
const chip: React.CSSProperties = {
  padding: "6px 12px", borderRadius: 100, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
  background: "none", border: "1px solid var(--line)", color: "var(--ink-2)",
};
const chipActive: React.CSSProperties = {
  ...chip, background: "var(--raise)", border: "1px solid var(--green)", color: "var(--ink)",
};
