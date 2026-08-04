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
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
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
        {t.treasuryId && (
          <button style={mineOnly ? chipActive : chip} onClick={() => setMineOnly((m) => !m)} type="button">
            ◇ my treasury only
          </button>
        )}
      </div>
      <ActivityFeed filter={filter} />
    </div>
  );
}

const chipRow: React.CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 };
const chip: React.CSSProperties = {
  padding: "6px 12px", borderRadius: 100, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
  background: "none", border: "1px solid var(--line)", color: "var(--ink-2)",
};
const chipActive: React.CSSProperties = {
  ...chip, background: "var(--raise)", border: "1px solid var(--green)", color: "var(--ink)",
};
