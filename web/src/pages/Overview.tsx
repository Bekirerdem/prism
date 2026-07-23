// The hero page: at a glance — how much is in the treasury, how much of today's limit
// is spent, is the policy live, what just happened. The forms moved to their own pages;
// this one answers "what is my state" first (the old Workspace showed inputs instead).
import { useEffect, useMemo, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { EXPLORER, fmtXlm, shortAddr } from "../config";
import { useTreasury } from "../state/useTreasury";
import { useAnalyticsScore } from "../lib/useAnalytics";
import { useTreasuryActivity } from "../lib/useTreasuryActivity";
import { loadPayeeBook, mergePayees, payeesFromEvents } from "../lib/payees";
import { setupProgress, type SetupStep } from "../lib/onboarding";
import { needsFunding, MIN_XLM } from "../lib/funding";
import type { View } from "../lib/routes";
import RecentActivity from "../components/shell/RecentActivity";
import StatStrip from "../components/shell/StatStrip";

const STEP_LABEL: Record<SetupStep, string> = {
  connect: "Connect",
  deploy: "Deploy",
  fund: "Fund",
  whitelist: "Whitelist",
  pay: "First payment",
};

const EASE = [0.2, 0.7, 0.3, 1] as const;
// Page-load choreography: hero first, then actions, then the lower zone.
const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: EASE },
});

/** Balance rolls up from 0 on mount (skipped under prefers-reduced-motion). */
function RollingBalance({ stroops }: { stroops: bigint }) {
  const reduce = useReducedMotion();
  const [text, setText] = useState("0");
  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, Number(stroops), {
      duration: 0.7,
      ease: EASE,
      onUpdate: (v) => setText(fmtXlm(BigInt(Math.round(v)))),
    });
    return () => controls.stop();
  }, [stroops, reduce]);
  return <>{reduce ? fmtXlm(stroops) : text}</>;
}

export default function Overview({ onGo }: { onGo: (v: View) => void }) {
  const t = useTreasury();
  const treasuryId = t.treasuryId as string; // the shell only renders Overview with one open
  const analytics = useAnalyticsScore(treasuryId, t.refreshKey);
  const { rows, freshId } = useTreasuryActivity(treasuryId, t.refreshKey);

  const [copied, setCopied] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [fundAmt, setFundAmt] = useState("");
  const [fundErr, setFundErr] = useState("");

  const payeeCount = useMemo(() => {
    if (analytics.status === "loading" && analytics.events.length === 0) return null;
    return mergePayees(payeesFromEvents(analytics.events), loadPayeeBook(treasuryId)).length;
  }, [analytics.events, analytics.status, treasuryId]);

  // Durable truths from the activity log — chain events older than the RPC's retention
  // window can't be re-scanned, but the Supabase log remembers them.
  const blockedCount = useMemo(() => rows.filter((e) => e.kind === "blocked").length, [rows]);
  const whitelistSeen = rows.some((e) => e.kind === "whitelist");
  const paidSeen = rows.some((e) => e.kind === "paid");

  const progress = setupProgress({
    connected: !!t.address,
    hasTreasury: true,
    balance: t.state?.balance ?? null,
    payeeCount: payeeCount || (whitelistSeen ? 1 : payeeCount),
    hasPaid: analytics.score.payments > 0 || paidSeen || (t.state ? t.state.daySpent > 0n : false),
  });

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(treasuryId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions) — the explorer link still exposes the full id.
    }
  };

  const doFund = async () => {
    setFundErr("");
    const res = await t.fund(fundAmt);
    if (res.ok) {
      setFundAmt("");
      setFundOpen(false);
    } else if (res.validation) {
      setFundErr(res.msg);
    }
  };

  const stepCta = () => {
    if (progress.next === "fund") setFundOpen(true);
    else if (progress.next === "whitelist" || progress.next === "pay") onGo("payments");
  };

  const s = t.state;
  const spentPct = s && s.dailyLimit > 0n ? Math.min(100, (Number(s.daySpent) / Number(s.dailyLimit)) * 100) : 0;
  const remaining = s ? (s.dailyLimit > s.daySpent ? s.dailyLimit - s.daySpent : 0n) : 0n;
  const leashOn = t.sessionActive;

  return (
    <div>
      {t.address && t.walletXlm !== undefined && needsFunding(t.walletXlm) && (
        <div style={fundGate}>
          <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
            {t.walletXlm === null
              ? "Your wallet doesn't exist on testnet yet (0 XLM)."
              : `Your wallet holds ${t.walletXlm.toFixed(2)} XLM on testnet.`}{" "}
            You need ~{MIN_XLM} XLM to fund a treasury — grab free testnet XLM.
          </div>
          <button
            style={{ ...primaryBtn, width: "auto", opacity: t.busy ? 0.6 : 1 }}
            onClick={() => void t.friendbot()}
            disabled={!!t.busy}
            type="button"
          >
            {t.busy === "friendbot" ? "Funding…" : "Get free testnet XLM"}
          </button>
        </div>
      )}

      {!progress.complete && (
        <div style={stepperCard}>
          <div style={stepRow}>
            {progress.steps.map(({ step, done }) => (
              <div key={step} style={stepItem}>
                <span
                  style={{
                    ...stepDot,
                    background: done ? "#FDDA24" : "rgba(255,255,255,0.12)",
                    color: done ? "#0F0F0F" : "#7C7C92",
                    outline: progress.next === step ? "2px solid rgba(253,218,36,0.5)" : "none",
                  }}
                >
                  {done ? "✓" : ""}
                </span>
                <span style={{ fontSize: 11.5, color: progress.next === step ? "#EDEDF4" : "#7C7C92" }}>
                  {STEP_LABEL[step]}
                </span>
              </div>
            ))}
          </div>
          {progress.next && progress.next !== "connect" && progress.next !== "deploy" && (
            <button style={stepCtaBtn} onClick={stepCta} type="button">
              Next: {STEP_LABEL[progress.next]} →
            </button>
          )}
        </div>
      )}

      <motion.div className="ov__hero" {...fadeUp(0)}>
        {/* SOL — balance */}
        <div style={heroLeft}>
          <div style={label}>Balance</div>
          {t.loading || !s ? (
            <>
              <div className="shell__skel" style={{ height: 58, width: "70%", marginTop: 8 }} />
              <div className="shell__skel" style={{ height: 16, width: "45%", marginTop: 12 }} />
            </>
          ) : (
            <>
              <div className="ov__balance">
                <RollingBalance stroops={s.balance} />
                <small>XLM</small>
              </div>
              <div style={chipRow}>
                {t.lifecycle?.paused ? (
                  <span style={{ ...chip, color: "#FF5D5D", borderColor: "rgba(255,93,93,0.4)" }}>⏸ Paused</span>
                ) : (
                  <span style={{ ...chip, color: "#00FF43", borderColor: "rgba(0,255,67,0.35)" }}>● Active</span>
                )}
                <span
                  style={{
                    ...chip,
                    color: leashOn ? "#E0A106" : "#7C7C92",
                    borderColor: leashOn ? "rgba(224,161,6,0.45)" : "rgba(255,255,255,0.12)",
                  }}
                >
                  ⚡ Leash: {leashOn ? "active" : "none"}
                </span>
              </div>
              <div style={idRow}>
                <a style={mono} href={`${EXPLORER}/contract/${treasuryId}`} target="_blank" rel="noreferrer">
                  {shortAddr(treasuryId)} ↗
                </a>
                <button style={copyBtn} onClick={copyId} type="button">
                  {copied ? "Copied ✓" : "Copy ID"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* SAĞ — today / policy live */}
        <div style={heroRight}>
          <div style={label}>Today — policy live</div>
          {t.loading || !s ? (
            <>
              <div className="shell__skel" style={{ height: 10, marginTop: 14 }} />
              <div className="shell__skel" style={{ height: 14, width: "60%", marginTop: 12 }} />
              <div className="shell__skel" style={{ height: 14, width: "50%", marginTop: 8 }} />
            </>
          ) : (
            <>
              <div style={barTrack}>
                <motion.div
                  style={barFill}
                  initial={{ width: 0 }}
                  animate={{ width: `${spentPct}%` }}
                  transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
                />
              </div>
              <div style={todayLine}>
                <strong style={{ color: "#EDEDF4" }}>
                  {fmtXlm(s.daySpent)} / {fmtXlm(s.dailyLimit)} XLM
                </strong>{" "}
                spent in the last 24h
              </div>
              <div style={todaySub}>per-payment ≤ {fmtXlm(s.perTaskLimit)} XLM</div>
              <div style={todaySub}>remaining today: {fmtXlm(remaining)} XLM</div>
              {blockedCount > 0 && (
                <div style={{ ...todaySub, color: "#FF5D5D" }}>
                  {blockedCount} drain attempt{blockedCount > 1 ? "s" : ""} blocked by the contract
                </div>
              )}
              {t.lifecycle?.paused && (
                <div style={{ ...todaySub, color: "#FF5D5D" }}>⏸ Spending frozen — withdraw still works.</div>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* QUICK ACTIONS */}
      <motion.div style={actions} {...fadeUp(0.12)}>
        <button
          style={{ ...primaryBtn, width: "auto", opacity: t.busy ? 0.6 : 1 }}
          onClick={() => setFundOpen((o) => !o)}
          disabled={!!t.busy && t.busy !== "fund"}
          type="button"
        >
          + Fund
        </button>
        <button style={ghostAction} onClick={() => onGo("payments")} type="button">
          → Send payment
        </button>
        <button style={ghostAction} onClick={() => onGo("agent")} type="button">
          {leashOn ? "⚡ Leash active →" : "⚡ Start Leash"}
        </button>
      </motion.div>
      {fundOpen && (
        <div style={fundPanel}>
          <input
            style={input}
            inputMode="decimal"
            placeholder="Amount (XLM)"
            aria-label="Fund amount in XLM"
            value={fundAmt}
            onChange={(e) => setFundAmt(e.target.value)}
          />
          <button
            style={{ ...primaryBtn, width: "auto", opacity: t.busy ? 0.6 : 1 }}
            onClick={() => void doFund()}
            disabled={!!t.busy}
            type="button"
          >
            {t.busy === "fund" ? "Funding…" : "Fund"}
          </button>
          {fundErr && <div style={inlineErr}>{fundErr}</div>}
        </div>
      )}

      {/* ALT BÖLGE */}
      <motion.div className="ov__lower" style={{ marginTop: 18 }} {...fadeUp(0.2)}>
        <RecentActivity rows={rows} freshId={freshId} onViewAll={() => onGo("activity")} />
        <StatStrip
          payments={analytics.score.payments}
          totalXlm={analytics.score.totalXlm}
          blocked={blockedCount}
          payees={payeeCount}
          truncated={analytics.truncated}
        />
      </motion.div>
    </div>
  );
}

const label: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#7C7C92" };
const heroLeft: React.CSSProperties = {
  padding: "22px 24px",
  borderRadius: 16,
  background: "rgba(18,18,28,0.6)",
  border: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  minHeight: 210,
};
const heroRight: React.CSSProperties = {
  padding: "22px 24px",
  borderRadius: 16,
  background: "rgba(253,218,36,0.045)",
  border: "1px solid rgba(253,218,36,0.22)",
  minHeight: 210,
  boxSizing: "border-box",
};
const chipRow: React.CSSProperties = { display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" };
const chip: React.CSSProperties = {
  fontSize: 12,
  padding: "4px 10px",
  borderRadius: 100,
  border: "1px solid",
  background: "rgba(0,0,0,0.25)",
};
const idRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, marginTop: 14 };
const mono: React.CSSProperties = { fontFamily: "ui-monospace, monospace", fontSize: 13.5, color: "#A0A0B8", textDecoration: "none" };
const copyBtn: React.CSSProperties = {
  padding: "3px 9px", borderRadius: 7, fontSize: 11.5, cursor: "pointer",
  background: "transparent", border: "1px solid rgba(255,255,255,0.18)", color: "#A0A0B8",
};
const barTrack: React.CSSProperties = {
  height: 8, borderRadius: 100, background: "rgba(255,255,255,0.08)", marginTop: 14, overflow: "hidden",
};
const barFill: React.CSSProperties = {
  height: "100%", borderRadius: 100, background: "#FDDA24",
  transition: "width .6s cubic-bezier(0.2, 0.7, 0.3, 1)",
};
const todayLine: React.CSSProperties = { fontSize: 13.5, color: "#A0A0B8", marginTop: 12 };
const todaySub: React.CSSProperties = { fontSize: 12.5, color: "#7C7C92", marginTop: 6 };
const actions: React.CSSProperties = { display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" };
const primaryBtn: React.CSSProperties = {
  padding: "11px 18px", borderRadius: 11, border: "none", cursor: "pointer",
  background: "#FDDA24", color: "#0F0F0F", fontWeight: 600, fontSize: 14, fontFamily: "inherit",
};
const ghostAction: React.CSSProperties = {
  padding: "11px 18px", borderRadius: 11, cursor: "pointer", fontSize: 14, fontFamily: "inherit",
  background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#EDEDF4",
};
const fundPanel: React.CSSProperties = {
  display: "flex", gap: 10, alignItems: "flex-start", marginTop: 10, flexWrap: "wrap",
  padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
};
const input: React.CSSProperties = {
  flex: 1, minWidth: 180, boxSizing: "border-box", padding: "11px 13px", borderRadius: 10,
  background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEDF4", fontSize: 14,
};
const inlineErr: React.CSSProperties = { width: "100%", fontSize: 12.5, color: "#FF5D5D" };
const fundGate: React.CSSProperties = {
  display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap",
  marginBottom: 16, padding: 14, borderRadius: 12,
  background: "rgba(253,218,36,0.07)", border: "1px solid rgba(253,218,36,0.35)", color: "#EDEDF4",
};
const stepperCard: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap",
  marginBottom: 16, padding: "12px 16px", borderRadius: 12,
  background: "rgba(18,18,28,0.55)", border: "1px solid rgba(255,255,255,0.08)",
};
const stepRow: React.CSSProperties = { display: "flex", gap: 16, flexWrap: "wrap" };
const stepItem: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7 };
const stepDot: React.CSSProperties = {
  width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center",
  justifyContent: "center", fontSize: 11, fontWeight: 700,
};
const stepCtaBtn: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 9, border: "none", cursor: "pointer",
  background: "rgba(253,218,36,0.14)", color: "#FDDA24", fontWeight: 600, fontSize: 12.5, fontFamily: "inherit",
};
