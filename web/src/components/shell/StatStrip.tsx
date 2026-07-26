// The Overview's 24h numbers — subordinate to the balance hero, not a page of its own
// (the old standalone Analytics view folded into this strip + the hero's instrument).
export default function StatStrip({
  payments,
  totalXlm,
  blocked,
  payees,
  truncated,
  anomaly = false,
}: {
  payments: number;
  totalXlm: number;
  blocked: number;
  payees: number | null;
  truncated: boolean;
  anomaly?: boolean;
}) {
  return (
    <div style={panel}>
      <div style={label}>Stats</div>
      <div style={grid}>
        <Stat label="Payments" value={String(payments)} />
        <Stat label="Total spent" value={`${totalXlm.toFixed(2)} XLM`} />
        <Stat label="Blocked" value={String(blocked)} danger={blocked > 0} />
        <Stat label="Payees" value={payees === null ? "—" : String(payees)} />
      </div>
      {/* Escalation of the Blocked stat above: the count says "it has happened", this says
          "it is happening right now" — a spike inside the recent window, which is what a
          misbehaving agent or a misconfigured policy actually looks like. */}
      {anomaly && (
        <div style={anomalyBanner}>
          <strong style={{ color: "#FF5D5D" }}>⚠ Blocked-payment spike</strong>
          <div style={{ color: "#EDEDF4", marginTop: 2 }}>
            Most of the recent payment attempts were rejected by the policy — check the agent
            and your limits.
          </div>
        </div>
      )}
      {truncated && (
        <div style={{ fontSize: 11, color: "#E0A106", marginTop: 8 }}>
          ⚠ Only recent events were read — totals may be partial.
        </div>
      )}
    </div>
  );
}

function Stat({ label: l, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div style={statBox}>
      <div style={statLabel}>{l}</div>
      <div style={{ ...statValue, color: danger ? "#FF5D5D" : "#EDEDF4" }}>{value}</div>
    </div>
  );
}

const panel: React.CSSProperties = {
  padding: 16,
  borderRadius: 14,
  background: "rgba(18,18,28,0.55)",
  border: "1px solid rgba(255,255,255,0.07)",
};
const label: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#7C7C92", marginBottom: 8 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
const statBox: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" };
const statLabel: React.CSSProperties = { fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.07em", color: "#7C7C92" };
const statValue: React.CSSProperties = { fontSize: 18, fontWeight: 600, marginTop: 2 };
const anomalyBanner: React.CSSProperties = {
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(255,93,93,0.10)",
  border: "1px solid rgba(255,93,93,0.30)",
  fontSize: 12.5,
  lineHeight: 1.45,
};
