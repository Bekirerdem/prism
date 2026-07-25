// Analytics + monitoring panel for the connected treasury: payment count, total spent,
// policy violations, runtime errors, and a small spend sparkline — the data engine lives
// in lib/useAnalytics so the shell's Overview reads the same numbers.
import { useMemo } from "react";
import { useAnalyticsScore } from "../lib/useAnalytics";
import { useTreasuryActivity } from "../lib/useTreasuryActivity";
import { computeAnomaly, mergeLedger } from "../lib/eventLedger";

export default function Analytics({ contractId, refreshKey = 0 }: { contractId: string; refreshKey?: number }) {
  const { score, series, monitor, status, truncated, refresh, events: onChainEvents } = useAnalyticsScore(contractId, refreshKey);
  const { rows } = useTreasuryActivity(contractId, refreshKey);
  
  const mergedEvents = useMemo(() => mergeLedger(onChainEvents, rows), [onChainEvents, rows]);
  const isAnomaly = computeAnomaly(mergedEvents);
  
  const max = Math.max(1, ...series.map((p) => p.xlm));

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={label}>Analytics &amp; monitoring</div>
        <button style={refreshBtn} onClick={refresh} type="button" aria-label="Refresh analytics">↻ Refresh</button>
      </div>

      {isAnomaly && (
        <div style={{ ...statBox, background: "rgba(255,93,93,0.1)", border: "1px solid rgba(255,93,93,0.3)", marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 20 }}>⚠</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#FF5D5D" }}>Anomaly detected</div>
            <div style={{ fontSize: 12, color: "#EDEDF4", marginTop: 2 }}>Spike in blocked payments detected in recent window.</div>
          </div>
        </div>
      )}

      <div style={grid}>
        <Stat label="Payments" value={String(score.payments)} />
        <Stat label="Total spent" value={`${score.totalXlm.toFixed(2)} XLM`} />
        <Stat label="Violations" value={String(monitor.violations)} danger={monitor.violations > 0} />
        <Stat label="Errors" value={String(monitor.errors)} danger={monitor.errors > 0} />
      </div>

      {series.length > 0 && (
        <>
          <div style={{ ...label, marginTop: 10 }}>Spend per payment</div>
          <div style={bars}>
            {series.slice(-12).map((p, i) => (
              <div key={i} title={`${p.xlm} XLM`} style={{ ...bar, height: `${Math.max(5, (p.xlm / max) * 42)}px` }} />
            ))}
          </div>
        </>
      )}

      <div style={{ fontSize: 11.5, color: "#7C7C92", marginTop: 8 }}>
        {status === "loading"
          ? "Reading on-chain activity…"
          : status === "error"
            ? "Couldn't reach RPC."
            : score.lastAt
              ? `Last payment ${timeAgo(score.lastAt)}`
              : "No payments yet — spend to see analytics."}
      </div>
      {truncated && status === "ready" && (
        <div style={{ fontSize: 11.5, color: "#E0A106", marginTop: 4 }}>
          ⚠ Only the most recent events were read — totals may be partial.
        </div>
      )}
    </div>
  );
}

function Stat({ label: l, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div style={statBox}>
      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.07em", color: "#7C7C92" }}>{l}</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2, color: danger ? "#FF5D5D" : "#EDEDF4" }}>{value}</div>
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

const label: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#7C7C92" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 };
const statBox: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" };
const bars: React.CSSProperties = { display: "flex", alignItems: "flex-end", gap: 4, height: 48, marginTop: 6 };
// Fixed-width bars: with only a payment or two, flex-grown bars read as giant buttons.
const bar: React.CSSProperties = { width: 22, background: "#FDDA24", borderRadius: 3 };
const refreshBtn: React.CSSProperties = {
  background: "transparent", border: "1px solid rgba(255,255,255,0.14)", color: "#A0A0B8",
  borderRadius: 8, padding: "4px 9px", fontSize: 11.5, cursor: "pointer",
};
