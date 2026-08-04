// The hero page. Its job is not to report a balance — it is to show that the rules are
// doing something. Every decision the contract made leads; the treasury's state and today's
// limit sit underneath as the context for those decisions.
//
// The old layout opened with a balance card beside a limit card, then four equal counters
// at the bottom (payments / spent / blocked / payees). That is an inventory, not a page:
// the single most important fact — a payment was stopped — was the smallest thing on screen.
import { useEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from "framer-motion";
import { EXPLORER, fmtXlm, shortAddr } from "../config";
import { useTreasury } from "../state/useTreasury";
import { useAnalyticsScore } from "../lib/useAnalytics";
import { useTreasuryActivity } from "../lib/useTreasuryActivity";
import { computeAnomaly, mergeLedger } from "../lib/eventLedger";
import { loadPayeeBook, mergePayees, payeesFromEvents } from "../lib/payees";
import { setupProgress, type SetupStep } from "../lib/onboarding";
import { needsFunding, MIN_XLM } from "../lib/funding";
import type { View } from "../lib/routes";
import RecentActivity from "../components/shell/RecentActivity";
import BottomSheet from "../components/shell/BottomSheet";
import { useIsMobile } from "../lib/useIsMobile";

// What the user should do next, in their words — one line, not a five-step strip. The
// stepper took permanent space at the top of a page whose subject is elsewhere.
const NEXT_LINE: Record<SetupStep, string> = {
  connect: "Connect a wallet to begin.",
  deploy: "Create your treasury with its rules built in.",
  fund: "Your treasury pays from its own balance — top it up to start.",
  whitelist: "Payments can only go to payees you've approved. Approve one.",
  pay: "Send a payment — watch your rules check it on the way through.",
};
const NEXT_CTA: Record<SetupStep, string> = {
  connect: "Connect",
  deploy: "Create",
  fund: "Fund it",
  whitelist: "Approve a payee",
  pay: "Send one",
};

const EASE = [0.2, 0.7, 0.3, 1] as const;
const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: EASE },
});

/** Balance rolls up from 0 on mount (skipped under prefers-reduced-motion). */
function RollingBalance({ stroops }: { stroops: bigint }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(Number(stroops));
  const [text, setText] = useState(() => fmtXlm(stroops));
  useMotionValueEvent(mv, "change", (v) => setText(fmtXlm(BigInt(Math.round(v)))));
  useEffect(() => {
    if (reduce) return;
    const controls = animate(mv, Number(stroops), { duration: 0.7, ease: EASE });
    return () => controls.stop();
  }, [stroops, reduce, mv]);
  return <>{reduce ? fmtXlm(stroops) : text}</>;
}

export default function Overview({ onGo }: { onGo: (v: View) => void }) {
  const t = useTreasury();
  const treasuryId = t.treasuryId as string; // the shell only renders Overview with one open
  const analytics = useAnalyticsScore(treasuryId, t.refreshKey);
  const { rows, freshId } = useTreasuryActivity(treasuryId, t.refreshKey);

  const [copied, setCopied] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const fundPanel = useRef<HTMLDivElement>(null);
  const fundInput = useRef<HTMLInputElement>(null);
  const [fundAmt, setFundAmt] = useState("");
  const [fundErr, setFundErr] = useState("");

  const payeeCount = useMemo(() => {
    if (analytics.status === "loading" && analytics.events.length === 0) return null;
    return mergePayees(payeesFromEvents(analytics.events), loadPayeeBook(treasuryId)).length;
  }, [analytics.events, analytics.status, treasuryId]);

  // Durable truths from the activity log — chain events older than the RPC's retention
  // window can't be re-scanned, but the Supabase log remembers them.
  const whitelistSeen = rows.some((e) => e.kind === "whitelist");
  const paidSeen = rows.some((e) => e.kind === "paid");

  // Anomaly runs on the MERGED, deduped ledger (chain scan + durable activity log) so a
  // Realtime row arriving before the RPC re-scan can't make the banner flicker on and off.
  const anomaly = useMemo(
    () => computeAnomaly(mergeLedger(analytics.events, rows)),
    [analytics.events, rows],
  );

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

  // On phones the fund form opens as a bottom sheet (the inline panel used to land under
  // the bottom tab bar); on desktop the inline panel stays, scrolled into view.
  const isMobile = useIsMobile();
  const openFund = () => {
    setFundOpen(true);
    if (isMobile) return; // the sheet carries its own focus
    requestAnimationFrame(() => {
      fundPanel.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      fundInput.current?.focus({ preventScroll: true });
    });
  };

  const fundForm = (inSheet: boolean) => (
    <>
      <input
        className="ov__input"
        ref={inSheet ? undefined : fundInput}
        autoFocus={inSheet}
        inputMode="decimal"
        placeholder="Amount in XLM"
        aria-label="Fund amount in XLM"
        value={fundAmt}
        onChange={(e) => setFundAmt(e.target.value)}
      />
      <button className="ov__btn" onClick={() => void doFund()} disabled={!!t.busy} type="button">
        {t.busy === "fund" ? "Funding…" : "Fund"}
      </button>
      {fundErr && <div className="ov__err">{fundErr}</div>}
    </>
  );

  const stepCta = () => {
    if (progress.next === "fund") openFund();
    else if (progress.next === "whitelist" || progress.next === "pay") onGo("payments");
  };

  const s = t.state;
  const spentPct = s && s.dailyLimit > 0n ? Math.min(100, (Number(s.daySpent) / Number(s.dailyLimit)) * 100) : 0;
  const remaining = s ? (s.dailyLimit > s.daySpent ? s.dailyLimit - s.daySpent : 0n) : 0n;
  const leashOn = t.sessionActive;

  return (
    <div>
      {t.legacy && (
        <div className="ov__notice">
          This is an early treasury — agent sessions, pause and withdraw arrived later. Your
          funds are safe;{" "}
          <button onClick={() => onGo("settings")} type="button">
            see Settings for the exit path
          </button>
        </div>
      )}

      {anomaly && (
        <div className="ov__notice">
          Most recent payment attempts were rejected. That is your rules working — but check
          whether the payee list or today's limit needs updating.
        </div>
      )}

      {t.address && t.walletXlm !== undefined && needsFunding(t.walletXlm) && (
        <div className="ov__next">
          <span>
            {t.walletXlm === null
              ? "Your wallet holds no testnet XLM yet."
              : `Your wallet holds ${t.walletXlm.toFixed(2)} XLM.`}{" "}
            You need about {MIN_XLM} XLM to fund a treasury.
          </span>
          <button className="ov__btn" onClick={() => void t.friendbot()} disabled={!!t.busy} type="button">
            {t.busy === "friendbot" ? "Sending…" : "Get test XLM"}
          </button>
        </div>
      )}

      {!progress.complete && progress.next && (
        <div className="ov__next">
          <span>{NEXT_LINE[progress.next]}</span>
          {progress.next !== "connect" && progress.next !== "deploy" && (
            <button className="ov__btn ov__btn--ghost" onClick={stepCta} type="button">
              {NEXT_CTA[progress.next]}
            </button>
          )}
        </div>
      )}

      {/* HERO — what the rules did */}
      <motion.div {...fadeUp(0)}>
        <RecentActivity rows={rows} freshId={freshId} onViewAll={() => onGo("activity")} />
      </motion.div>

      {/* SECOND TIER — the state behind those decisions */}
      <motion.div className="ov__tier" {...fadeUp(0.12)}>
        <div className="ov__card">
          <div className="ov__label">Treasury</div>
          {t.loading || !s ? (
            <>
              <div className="shell__skel" style={{ height: 56, width: "70%", marginTop: 10 }} />
              <div className="shell__skel" style={{ height: 16, width: "45%", marginTop: 14 }} />
            </>
          ) : (
            <>
              <div className="ov__balance">
                <RollingBalance stroops={s.balance} />
                <small>XLM</small>
              </div>
              <div className="ov__chips">
                {t.lifecycle?.paused ? (
                  <span className="ov__chip ov__chip--paused">Spending frozen</span>
                ) : (
                  <span className="ov__chip ov__chip--live">Rules live</span>
                )}
                <span className="ov__chip">{leashOn ? "Leash active" : "No leash"}</span>
              </div>
              <div className="ov__idrow">
                <a className="ov__id" href={`${EXPLORER}/contract/${treasuryId}`} target="_blank" rel="noreferrer">
                  {shortAddr(treasuryId)} ↗
                </a>
                <button className="ov__copy" onClick={copyId} type="button">
                  {copied ? "Copied" : "Copy ID"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="ov__card">
          <div className="ov__label">Today's limit</div>
          {t.loading || !s ? (
            <>
              <div className="shell__skel" style={{ height: 10, marginTop: 14 }} />
              <div className="shell__skel" style={{ height: 22, width: "60%", marginTop: 14 }} />
              <div className="shell__skel" style={{ height: 14, width: "50%", marginTop: 10 }} />
            </>
          ) : (
            <>
              <div className="ov__track">
                <motion.div
                  className="ov__fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${spentPct}%` }}
                  transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
                />
              </div>
              <div className="ov__spent">
                {fmtXlm(s.daySpent)} / {fmtXlm(s.dailyLimit)} XLM
              </div>
              <div className="ov__rule">
                <strong>{fmtXlm(remaining)} XLM</strong> left today
              </div>
              <div className="ov__rule">
                At most <strong>{fmtXlm(s.perTaskLimit)} XLM</strong> per payment
              </div>
              <div className="ov__rule">
                {payeeCount === null ? "Checking approved payees…" : (
                  <><strong>{payeeCount}</strong> approved payee{payeeCount === 1 ? "" : "s"}</>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>

      <motion.div className="ov__actions" {...fadeUp(0.2)}>
        <button
          className="ov__btn"
          onClick={() => (fundOpen ? setFundOpen(false) : openFund())}
          disabled={!!t.busy && t.busy !== "fund"}
          type="button"
        >
          Fund
        </button>
        <button className="ov__btn ov__btn--ghost" onClick={() => onGo("payments")} type="button">
          Send payment
        </button>
        <button className="ov__btn ov__btn--ghost" onClick={() => onGo("agent")} type="button">
          {leashOn ? "Leash active" : "Start leash"}
        </button>
      </motion.div>

      {fundOpen && !isMobile && (
        <div className="ov__panel" ref={fundPanel}>
          {fundForm(false)}
        </div>
      )}
      <BottomSheet open={fundOpen && isMobile} onClose={() => setFundOpen(false)} title="Fund treasury">
        <div className="ov__panel" style={{ marginTop: 0, border: "none", padding: 0, background: "none" }}>
          {fundForm(true)}
        </div>
      </BottomSheet>
    </div>
  );
}
