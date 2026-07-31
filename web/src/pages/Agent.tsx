// The Leash: hand the treasury to an autonomous agent on a time-bound, spend-capped
// session key. Active state shows the live cap + countdown and the demo task button;
// inactive state explains the model and starts one. The single-spender rule and the
// "registered but unfunded key" recovery path live in the provider.
import { useEffect, useState } from "react";
import { fmtXlm, shortAddr } from "../config";
import { useNow } from "../lib/useNow";
import { useTreasury } from "../state/useTreasury";

export default function Agent() {
  const t = useTreasury();
  const [cap, setCap] = useState("25");
  const [hours, setHours] = useState("24");
  const [err, setErr] = useState("");

  const session = t.lifecycle?.session ?? null;
  const active = t.sessionActive && session;
  const now = useNow(!!active);

  // Auto-refresh once the session lapses so the UI flips itself.
  useEffect(() => {
    if (!active || !session) return;
    if (Number(session.valid_until) * 1000 < Date.now()) void t.refresh({ markLoading: false });
  }, [active, session, now, t]);

  const doStart = async () => {
    setErr("");
    const res = await t.startLeash(cap, hours);
    if (!res.ok && res.validation) setErr(res.msg);
  };

  if (t.legacy) {
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={label}>Leash — agent session</div>
          <div style={body}>
            This is an early treasury — Leash sessions arrived later. Create a fresh
            treasury from the switcher to use the agent features; your funds are safe,
            and Settings shows the exit path.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      {active ? (
        <div style={{ ...card, borderColor: "rgba(224,161,6,0.35)" }}>
          <div style={{ ...label, color: "#E0A106" }}>⚡ Leash active</div>

          <div style={statGrid}>
            <div>
              <div style={label}>Agent</div>
              <div style={mono}>{shortAddr(session.agent)}</div>
            </div>
            <div>
              <div style={label}>Key</div>
              <div style={{ fontSize: 13, color: t.sessionSecret ? "#00FF43" : "#E0A106" }}>
                {t.sessionSecret ? "on this device" : "elsewhere"}
              </div>
            </div>
          </div>

          <div style={{ ...label, marginTop: 16 }}>Session cap</div>
          <div style={barTrack}>
            <div
              style={{
                ...barFill,
                width: `${Math.min(100, (Number(session.spent) / Math.max(1, Number(session.limit))) * 100)}%`,
              }}
            />
          </div>
          <div style={body}>
            {fmtXlm(session.spent)} / {fmtXlm(session.limit)} XLM spent ·{" "}
            {fmtXlm(session.limit - session.spent)} XLM left
          </div>
          <div style={{ ...body, marginTop: 4 }}>expires in {countdown(Number(session.valid_until) * 1000 - now)}</div>

          {t.sessionSecret ? (
            <button
              style={{ ...primaryBtn, opacity: t.busy ? 0.6 : 1 }}
              onClick={() => void t.runAutonomousTask()}
              disabled={!!t.busy}
              type="button"
            >
              {t.busy === "task" ? "Agent paying…" : "Run autonomous task (1 XLM, no popup)"}
            </button>
          ) : (
            <div style={hint}>
              The session key isn't on this device — revoke below and start a new session to
              spend from here.
            </div>
          )}
          <button
            style={{ ...ghostBtn, opacity: t.busy ? 0.6 : 1 }}
            onClick={() => void t.revokeLeash()}
            disabled={!!t.busy}
            type="button"
          >
            {t.busy === "revoke" ? "Revoking…" : "Revoke Leash"}
          </button>
        </div>
      ) : (
        <div style={card}>
          <div style={label}>Leash — agent session</div>
          <div style={body}>
            Put your agent on a Leash: a spending cap and a time limit. It pays on its own —
            no popups — and every payment is still checked against your rules. Revoke any time.
          </div>
          <div style={fieldLabel}>Session cap (XLM)</div>
          <input
            style={input}
            inputMode="decimal"
            aria-label="Session spending cap in XLM"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
          />
          <div style={fieldLabel}>Duration (hours)</div>
          <input
            style={input}
            inputMode="decimal"
            aria-label="Session duration in hours"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
          <button
            style={{ ...primaryBtn, opacity: t.busy ? 0.6 : 1 }}
            onClick={() => void doStart()}
            disabled={!!t.busy}
            type="button"
          >
            {t.busy === "session" ? "Starting…" : "Start Leash"}
          </button>
          {err && <div style={inlineErr}>{err}</div>}
        </div>
      )}
    </div>
  );
}

function countdown(ms: number): string {
  if (ms <= 0) return "expired";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

const wrap: React.CSSProperties = { maxWidth: 560, margin: "0 auto" };
const card: React.CSSProperties = {
  padding: 20, borderRadius: 14,
  background: "rgba(18,18,28,0.6)", border: "1px solid rgba(255,255,255,0.08)",
};
const label: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#7C7C92" };
const fieldLabel: React.CSSProperties = { ...label, marginTop: 12 };
const body: React.CSSProperties = { fontSize: 13, color: "#A0A0B8", lineHeight: 1.55, marginTop: 8 };
const hint: React.CSSProperties = { marginTop: 12, fontSize: 12, color: "#7C7C92", lineHeight: 1.5 };
const mono: React.CSSProperties = { fontFamily: "ui-monospace, monospace", fontSize: 13.5, color: "#EDEDF4", marginTop: 3 };
const statGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 };
const barTrack: React.CSSProperties = { height: 8, borderRadius: 100, background: "rgba(255,255,255,0.08)", marginTop: 8, overflow: "hidden" };
const barFill: React.CSSProperties = { height: "100%", borderRadius: 100, background: "#E0A106", transition: "width .5s ease" };
const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 8, padding: "11px 13px", borderRadius: 10,
  background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEDF4",
};
const primaryBtn: React.CSSProperties = {
  width: "100%", marginTop: 14, padding: "12px 16px", borderRadius: 11, border: "none", cursor: "pointer",
  background: "#FDDA24", color: "#0F0F0F", fontWeight: 600, fontSize: 14.5, fontFamily: "inherit",
};
const ghostBtn: React.CSSProperties = {
  width: "100%", marginTop: 8, padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontFamily: "inherit",
  background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#A0A0B8",
};
const inlineErr: React.CSSProperties = { marginTop: 8, fontSize: 12.5, color: "#FF5D5D" };
