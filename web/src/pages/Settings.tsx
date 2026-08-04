// Treasury settings: identity (full ID + registry status with catch-up registration),
// live limit updates, and the danger zone (pause / owner withdraw — the exit paths that
// keep working even while paused).
import { useState } from "react";
import { EXPLORER, fmtXlm, shortAddr } from "../config";
import { useTreasury } from "../state/useTreasury";

export default function Settings() {
  const t = useTreasury();
  const treasuryId = t.treasuryId as string;
  const registered = t.treasuries.find((x) => x.id === treasuryId)?.registered ?? false;

  const [copied, setCopied] = useState(false);
  const [newDaily, setNewDaily] = useState("");
  const [newPerTask, setNewPerTask] = useState("");
  const [limitsErr, setLimitsErr] = useState("");
  const [withdrawTo, setWithdrawTo] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [withdrawErr, setWithdrawErr] = useState("");

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(treasuryId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions) — the explorer link still exposes the full id.
    }
  };

  const doLimits = async () => {
    setLimitsErr("");
    const res = await t.updateLimits(newDaily, newPerTask);
    if (res.ok) {
      setNewDaily("");
      setNewPerTask("");
    } else if (res.validation) setLimitsErr(res.msg);
  };

  const doWithdraw = async () => {
    setWithdrawErr("");
    const res = await t.withdraw(withdrawTo, withdrawAmt);
    if (res.ok) setWithdrawAmt("");
    else if (res.validation) setWithdrawErr(res.msg);
  };

  return (
    <div className="page">
      <div className="page__main">
      {/* ---- treasury identity ---- */}
      <div style={card}>
        <div style={label}>Treasury</div>
        <div style={idBox}>{treasuryId}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button style={smallBtn} onClick={copyId} type="button">
            {copied ? "Copied ✓" : "Copy ID"}
          </button>
          <a style={smallLink} href={`${EXPLORER}/contract/${treasuryId}`} target="_blank" rel="noreferrer">
            View on explorer ↗
          </a>
        </div>
        <div style={{ marginTop: 14 }}>
          {registered ? (
            <div style={{ fontSize: 13, color: "var(--ink)" }}>Backed up on Stellar ✓ — open it from any device.</div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: "var(--red)" }}>
                ⚠ Not backed up on Stellar — this device's storage is the only key to this
                treasury. Save the ID, or back it up now.
              </div>
              <button
                style={{ ...primaryBtn, width: "auto", opacity: t.busy ? 0.6 : 1 }}
                onClick={() => void t.registerActive()}
                disabled={!!t.busy}
                type="button"
              >
                {t.busy === "register" ? "Backing up…" : "Back up on Stellar"}
              </button>
            </>
          )}
        </div>
        <div style={hint}>
          Owner: <span style={mono}>{t.address ? shortAddr(t.address) : "—"}</span>
        </div>
      </div>

      {/* ---- limits ---- */}
      <div style={card}>
        <div style={label}>Limits</div>
        {t.state && (
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 8 }}>
            Current: {fmtXlm(t.state.dailyLimit)} XLM / day · ≤ {fmtXlm(t.state.perTaskLimit)} XLM per payment
          </div>
        )}
        <div style={fieldLabel}>New daily limit (XLM)</div>
        <input
          style={input}
          inputMode="decimal"
          aria-label="New daily limit in XLM"
          placeholder={t.state ? fmtXlm(t.state.dailyLimit) : ""}
          value={newDaily}
          onChange={(e) => setNewDaily(e.target.value)}
        />
        <div style={fieldLabel}>New per-payment limit (XLM)</div>
        <input
          style={input}
          inputMode="decimal"
          aria-label="New per-payment limit in XLM"
          placeholder={t.state ? fmtXlm(t.state.perTaskLimit) : ""}
          value={newPerTask}
          onChange={(e) => setNewPerTask(e.target.value)}
        />
        <button
          style={{ ...primaryBtn, opacity: t.busy ? 0.6 : 1 }}
          onClick={() => void doLimits()}
          disabled={!!t.busy || t.legacy}
          type="button"
        >
          {t.busy === "limits" ? "Updating…" : "Update limits"}
        </button>
        {limitsErr && <div style={inlineErr}>{limitsErr}</div>}
        {t.legacy && <div style={hint}>This is an early treasury — limit updates need a fresh treasury.</div>}
        {!t.legacy && <div style={hint}>Effective immediately, enforced on Stellar.</div>}
      </div>
      </div>

      {/* The exit paths sit apart from the settings you change day to day — pausing and
          withdrawing are not edits, they are ways out. */}
      <div className="page__side">
      <div style={{ ...card, borderColor: "var(--red)" }}>
        <div style={{ ...label, color: "var(--red)" }}>Danger zone</div>

        {t.legacy ? (
          <div style={hint}>
            This early treasury has no withdraw of its own. To move funds out: approve your
            own wallet as a payee (Payments → Payees), then pay yourself within the limits
            {t.state
              ? ` (≤ ${fmtXlm(t.state.perTaskLimit)} XLM per payment · ≤ ${fmtXlm(t.state.dailyLimit)} XLM per day)`
              : ""}
            . Or create a fresh treasury from the switcher — pause, withdraw and the Leash
            all live there.
          </div>
        ) : (
          <>
            <button
              style={{ ...ghostBtn, opacity: t.busy ? 0.6 : 1 }}
              onClick={() => void t.togglePause()}
              disabled={!!t.busy}
              type="button"
            >
              {t.busy === "pause" ? "Working…" : t.lifecycle?.paused ? "Resume spending" : "Pause spending"}
            </button>
            {t.lifecycle?.paused && (
              <div style={{ ...hint, color: "var(--red)" }}>Spending is frozen — withdraw still works.</div>
            )}

            <div style={{ ...fieldLabel, marginTop: 16 }}>Withdraw (owner exit — works while paused)</div>
            <input
              style={input}
              placeholder={`To (default: your wallet ${t.address ? shortAddr(t.address) : ""})`}
              aria-label="Withdraw destination address"
              value={withdrawTo}
              onChange={(e) => setWithdrawTo(e.target.value)}
            />
            <input
              style={input}
              inputMode="decimal"
              placeholder="Amount (XLM)"
              aria-label="Withdraw amount in XLM"
              value={withdrawAmt}
              onChange={(e) => setWithdrawAmt(e.target.value)}
            />
            <button
              style={{ ...ghostBtn, opacity: t.busy ? 0.6 : 1 }}
              onClick={() => void doWithdraw()}
              disabled={!!t.busy}
              type="button"
            >
              {t.busy === "withdraw" ? "Withdrawing…" : "Withdraw"}
            </button>
            {withdrawErr && <div style={inlineErr}>{withdrawErr}</div>}
          </>
        )}
      </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  padding: 20, borderRadius: 14,
  background: "var(--surface)", border: "1px solid var(--line)",
};
const label: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-2)" };
const fieldLabel: React.CSSProperties = { ...label, marginTop: 12 };
const idBox: React.CSSProperties = {
  marginTop: 10, padding: "10px 12px", borderRadius: 10, fontSize: 12.5,
  fontFamily: "ui-monospace, monospace", color: "var(--ink)", wordBreak: "break-all",
  background: "var(--bg)", border: "1px solid var(--line)",
};
const smallBtn: React.CSSProperties = {
  padding: "5px 11px", borderRadius: 8, fontSize: 12, cursor: "pointer",
  background: "transparent", border: "1px solid var(--line)", color: "var(--ink-2)",
};
const smallLink: React.CSSProperties = { fontSize: 12.5, color: "var(--ink-2)" };
const mono: React.CSSProperties = { fontFamily: "ui-monospace, monospace" };
const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 8, padding: "11px 13px", borderRadius: 10,
  background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)",
};
const primaryBtn: React.CSSProperties = {
  width: "100%", marginTop: 12, padding: "12px 16px", borderRadius: 11, border: "none", cursor: "pointer",
  background: "var(--ink)", color: "var(--bg)", fontWeight: 600, fontSize: 14, fontFamily: "inherit",
};
const ghostBtn: React.CSSProperties = {
  width: "100%", marginTop: 10, padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontFamily: "inherit",
  background: "transparent", border: "1px solid var(--line)", color: "var(--ink-2)",
};
const hint: React.CSSProperties = { marginTop: 10, fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 };
const inlineErr: React.CSSProperties = { marginTop: 8, fontSize: 12.5, color: "var(--red)" };
