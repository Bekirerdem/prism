// The Overview's "last 5 things that happened to THIS treasury" — pure display; the
// data (durable history + live stream) comes from useTreasuryActivity in the parent,
// which also feeds the stat counters, so both always agree.
import { AnimatePresence, motion } from "framer-motion";
import { EXPLORER } from "../../config";
import type { FeedEvent } from "../../lib/events";
import { kindColor } from "../../lib/feedFilter";

const SHOW = 5;

export default function RecentActivity({
  rows,
  freshId,
  onViewAll,
}: {
  rows: FeedEvent[];
  freshId: string | null;
  onViewAll: () => void;
}) {
  const shown = rows.slice(0, SHOW);

  return (
    <div style={panel}>
      <div style={head}>
        <div style={label}>Recent activity</div>
        <button style={viewAll} onClick={onViewAll} type="button">
          View all →
        </button>
      </div>
      {shown.length === 0 ? (
        <div style={empty}>No activity yet — fund your treasury to get started.</div>
      ) : (
        <div>
          <AnimatePresence initial={false}>
            {shown.map((e) => (
              <motion.div
                key={e.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  backgroundColor:
                    freshId === e.id && e.kind === "blocked"
                      ? ["rgba(255,93,93,0.18)", "rgba(255,93,93,0)"]
                      : "rgba(255,93,93,0)",
                }}
                transition={{ duration: 0.35 }}
                style={row}
              >
                <span style={{ ...dot, background: kindColor(e.kind), boxShadow: `0 0 6px ${kindColor(e.kind)}66` }} />
                <span style={rowLabel}>{e.label}</span>
                <span style={when}>{timeAgo(e.at)}</span>
                {e.txHash && (
                  <a style={txLink} href={`${EXPLORER}/tx/${e.txHash}`} target="_blank" rel="noreferrer">
                    ↗
                  </a>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const panel: React.CSSProperties = {
  padding: 16,
  borderRadius: 14,
  background: "rgba(18,18,28,0.55)",
  border: "1px solid rgba(255,255,255,0.07)",
};
const head: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 };
const label: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#7C7C92" };
const viewAll: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", padding: 0,
  color: "#A0A0B8", fontSize: 12, fontFamily: "inherit",
};
const empty: React.CSSProperties = { fontSize: 13, color: "#7C7C92", padding: "14px 0 8px" };
const row: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "9px 6px", borderRadius: 8, fontSize: 13, color: "#EDEDF4",
};
const dot: React.CSSProperties = { width: 7, height: 7, borderRadius: "50%", flex: "0 0 auto" };
const rowLabel: React.CSSProperties = { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const when: React.CSSProperties = { color: "#7C7C92", fontSize: 11.5, flex: "0 0 auto" };
const txLink: React.CSSProperties = { color: "#A0A0B8", textDecoration: "none", fontSize: 12 };
