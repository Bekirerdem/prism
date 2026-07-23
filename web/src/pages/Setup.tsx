// The pre-treasury experience: a connect gate for visitors, then a two-step creation
// wizard (limits → deploy) in human language — no bare form dump. "Open an existing
// treasury" stays as the quiet secondary path.
import { useState } from "react";
import { useTreasury } from "../state/useTreasury";
import { needsFunding, MIN_XLM } from "../lib/funding";
import type { View } from "../lib/routes";

export default function Setup({ onGo }: { onGo: (v: View) => void }) {
  const t = useTreasury();
  const [daily, setDaily] = useState("50");
  const [perTask, setPerTask] = useState("10");
  const [existing, setExisting] = useState("");
  const [err, setErr] = useState("");
  const [openErr, setOpenErr] = useState("");

  const doDeploy = async () => {
    setErr("");
    const res = await t.deploy(daily, perTask);
    if (!res.ok && res.validation) setErr(res.msg);
  };

  const doOpen = () => {
    setOpenErr("");
    const res = t.openExisting(existing);
    if (!res.ok) setOpenErr(res.msg);
  };

  // ---- connect gate -------------------------------------------------------------
  if (!t.address) {
    return (
      <div style={gateWrap}>
        <div style={gateCard}>
          <div style={gateGlyph}>◭</div>
          <h1 style={gateTitle}>Your own bounded treasury on Stellar.</h1>
          <p style={gateSub}>
            You set the limits, the contract enforces them — every payment checked on-chain,
            every drain attempt blocked.
          </p>
          <button
            style={{ ...primaryBtn, opacity: t.busy === "connect" ? 0.6 : 1 }}
            onClick={() => void t.connect()}
            disabled={t.busy === "connect"}
            type="button"
          >
            {t.busy === "connect" ? "Connecting…" : "Connect wallet"}
          </button>
          <button style={demoLink} onClick={() => onGo("dashboard")} type="button">
            watch the demo →
          </button>
        </div>
      </div>
    );
  }

  // ---- creation wizard ----------------------------------------------------------
  return (
    <div style={wizWrap}>
      {t.creatingNew && t.treasuryId && (
        <button style={backLink} onClick={t.cancelNewTreasury} type="button">
          ← Back to your current treasury
        </button>
      )}
      <h1 style={wizTitle}>Set up your treasury</h1>
      <p style={wizSub}>Two steps: choose your limits, then deploy. The contract does the rest.</p>

      {t.walletXlm !== undefined && needsFunding(t.walletXlm) && (
        <div style={stepCard}>
          <div style={stepTag}>Step 0 — testnet XLM</div>
          <div style={stepBody}>
            {t.walletXlm === null
              ? "Your wallet doesn't exist on testnet yet (0 XLM). "
              : `Your wallet holds ${t.walletXlm.toFixed(2)} XLM on testnet. `}
            You need ~{MIN_XLM} XLM to deploy and fund a treasury — it's free.
          </div>
          <button
            style={{ ...primaryBtn, opacity: t.busy ? 0.6 : 1 }}
            onClick={() => void t.friendbot()}
            disabled={!!t.busy}
            type="button"
          >
            {t.busy === "friendbot" ? "Funding…" : "Get free testnet XLM"}
          </button>
        </div>
      )}

      <div style={stepCard}>
        <div style={stepTag}>Step 1 — set your limits</div>
        <div style={fieldLabel}>Daily limit (XLM)</div>
        <input
          style={input}
          inputMode="decimal"
          aria-label="Daily limit in XLM"
          value={daily}
          onChange={(e) => setDaily(e.target.value)}
        />
        <div style={fieldLabel}>Per-payment limit (XLM)</div>
        <input
          style={input}
          inputMode="decimal"
          aria-label="Per-payment limit in XLM"
          value={perTask}
          onChange={(e) => setPerTask(e.target.value)}
        />
        <div style={stepBody}>
          Your agent can never spend more than the daily limit in any rolling 24 hours, and
          never more than the per-payment limit at once — the contract enforces it, not a promise.
        </div>
      </div>

      <div style={stepCard}>
        <div style={stepTag}>Step 2 — deploy</div>
        <button
          style={{ ...primaryBtn, opacity: t.busy ? 0.6 : 1 }}
          onClick={() => void doDeploy()}
          disabled={!!t.busy}
          type="button"
        >
          {t.busy === "deploy" ? "Deploying…" : "Create treasury"}
        </button>
        {err && <div style={inlineErr}>{err}</div>}
        <div style={hint}>
          Deploying asks for <strong>two</strong> wallet approvals: ① create the treasury,
          ② register it for cross-device recovery — ② is optional; skipping it just means
          you should back up your treasury ID.
        </div>
      </div>

      <div style={divider} />
      <div style={secondary}>
        <div style={fieldLabel}>Already have a treasury?</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            style={{ ...input, flex: 1, minWidth: 220, marginTop: 0 }}
            placeholder="Treasury contract id (C…)"
            aria-label="Existing treasury contract id"
            value={existing}
            onChange={(e) => setExisting(e.target.value)}
          />
          <button style={ghostBtn} onClick={doOpen} type="button">
            Open it
          </button>
        </div>
        {openErr && <div style={inlineErr}>{openErr}</div>}
      </div>
    </div>
  );
}

const backLink: React.CSSProperties = {
  background: "none", border: "none", padding: 0, marginBottom: 14, cursor: "pointer",
  color: "#7C7C92", fontSize: 13, fontFamily: "inherit",
};
const gateWrap: React.CSSProperties = { minHeight: "70vh", display: "grid", placeItems: "center" };
const gateCard: React.CSSProperties = { maxWidth: 440, textAlign: "center", padding: "24px 16px" };
const gateGlyph: React.CSSProperties = { fontSize: 40, color: "#FDDA24", marginBottom: 14 };
const gateTitle: React.CSSProperties = {
  margin: 0, fontSize: 30, letterSpacing: "-0.02em",
  fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, color: "#EDEDF4", lineHeight: 1.2,
};
const gateSub: React.CSSProperties = { color: "#A0A0B8", fontSize: 14.5, lineHeight: 1.6, marginTop: 12 };
const demoLink: React.CSSProperties = {
  display: "block", margin: "14px auto 0", background: "none", border: "none", cursor: "pointer",
  color: "#7C7C92", fontSize: 13, fontFamily: "inherit",
};
const wizWrap: React.CSSProperties = { maxWidth: 560, margin: "0 auto" };
const wizTitle: React.CSSProperties = {
  margin: 0, fontSize: 27, letterSpacing: "-0.02em",
  fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, color: "#EDEDF4",
};
const wizSub: React.CSSProperties = { color: "#A0A0B8", fontSize: 14, marginTop: 6, marginBottom: 18 };
const stepCard: React.CSSProperties = {
  padding: 18, borderRadius: 14, marginBottom: 14,
  background: "rgba(18,18,28,0.6)", border: "1px solid rgba(255,255,255,0.08)",
};
const stepTag: React.CSSProperties = {
  fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#FDDA24", marginBottom: 8,
};
const stepBody: React.CSSProperties = { fontSize: 13, color: "#A0A0B8", lineHeight: 1.55, marginTop: 10 };
const fieldLabel: React.CSSProperties = {
  fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#7C7C92", marginTop: 10,
};
const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 8, padding: "11px 13px", borderRadius: 10,
  background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEDF4", fontSize: 14,
};
const primaryBtn: React.CSSProperties = {
  marginTop: 12, padding: "12px 18px", borderRadius: 11, border: "none", cursor: "pointer",
  background: "#FDDA24", color: "#0F0F0F", fontWeight: 600, fontSize: 14.5, fontFamily: "inherit",
};
const ghostBtn: React.CSSProperties = {
  padding: "11px 16px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontFamily: "inherit",
  background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#A0A0B8",
};
const hint: React.CSSProperties = { marginTop: 10, fontSize: 12, color: "#7C7C92", lineHeight: 1.5 };
const inlineErr: React.CSSProperties = { marginTop: 8, fontSize: 12.5, color: "#FF5D5D" };
const divider: React.CSSProperties = { height: 1, background: "rgba(255,255,255,0.07)", margin: "22px 0 14px" };
const secondary: React.CSSProperties = { opacity: 0.9 };
