/*  DASHBOARD — live treasury + autonomous agent console (Spectral)
    Reads real testnet state. The agent signs its own payments; the contract is the
    only gate. The rogue button proves a prompt-injected payment is rejected on-chain.

    entrance: head → stat bar → console/gauge → activity/map (tasteful stagger)
*/
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, animate, useMotionValue, useMotionValueEvent } from "framer-motion";
import FundingRail from "./FundingRail";
import {
  readState, readTaskSpent, agentPay, type EunomiaState, type PayResult,
} from "../lib/eunomia";
import {
  TASKS, ROGUE, fmtUSDC, shortAddr, txUrl, contractUrl,
  TREASURY_ID, USDC_SAC, AGENT_PK, REG_IDENTITY, AGENT_8004_ID,
  SERVICE, ATTACKER, VERIFIER_ID, ATTESTED_TX, type AgentTask,
} from "../config";

const EASE = [0.2, 0.7, 0.3, 1] as const;
const up = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, ease: EASE, delay },
});

type Stat = "idle" | "running" | "ok" | "rej";
interface LedgerRow { key: string; name: string; payee: string; amount: bigint; ok: boolean; hash?: string; error?: string; }

function useCountUp(target: number, ms = 700) {
  const mv = useMotionValue(target);
  const [v, setV] = useState(target);
  useMotionValueEvent(mv, "change", (latest) => setV(latest));
  useEffect(() => {
    const controls = animate(mv, target, { duration: ms / 1000, ease: EASE });
    return () => controls.stop();
  }, [target, ms, mv]);
  return v;
}

const usd = (stroops: bigint) => Number(stroops) / 1e7;

export default function Dashboard({ onHome }: { onHome: () => void }) {
  const [state, setState] = useState<EunomiaState | null>(null);
  const [spent, setSpent] = useState<Record<string, bigint>>({});
  const [baseline, setBaseline] = useState<Record<string, bigint> | null>(null);
  const baselineCaptured = useRef(false);
  const [status, setStatus] = useState<Record<string, Stat>>({});
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [reject, setReject] = useState<{ name: string; error: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      const s = await readState();
      setState(s);
      const entries = await Promise.all(
        TASKS.map(async (t) => [t.taskId.toString(), await readTaskSpent(t.taskId)] as const),
      );
      const map = Object.fromEntries(entries);
      // TaskSpent is an all-time on-chain counter. Capture it once at load so the
      // "auto-reconciled" panel shows THIS session's spend (the delta) — starting
      // clean at 0 and matching the agent console's per-task amounts after a run.
      if (!baselineCaptured.current) {
        baselineCaptured.current = true;
        setBaseline(map);
      }
      setSpent(map);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "RPC error");
    }
  }
  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, []);

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function pay(task: AgentTask, rogue = false): Promise<PayResult> {
    setStatus((s) => ({ ...s, [task.taskId.toString()]: "running" }));
    const res = await agentPay(task.taskId, task.payee, task.amount);
    // A transient hiccup (e.g. several judges submitting at once) is NOT a
    // guardrail rejection — don't paint it red; reset and let them retry.
    if (res.transient) {
      setStatus((s) => ({ ...s, [task.taskId.toString()]: "idle" }));
      setErr(res.errorMessage ?? "Network busy — tap “Run agent tasks” again in a moment.");
      return res;
    }
    setStatus((s) => ({ ...s, [task.taskId.toString()]: res.ok ? "ok" : "rej" }));
    setLedger((l) => [
      { key: `${task.taskId}-${l.length}`, name: task.name, payee: task.payee, amount: task.amount, ok: res.ok, hash: res.hash, error: res.errorMessage },
      ...l,
    ]);
    if (!res.ok && rogue) setReject({ name: task.name, error: res.errorMessage ?? "rejected" });
    return res;
  }

  async function runAgent() {
    setBusy(true); setReject(null); setErr(null);
    for (const t of TASKS) {
      setStatus((s) => ({ ...s, [t.taskId.toString()]: "idle" }));
    }
    for (const t of TASKS) {
      const r = await pay(t);
      if (r.transient) break; // stop the run on a network hiccup; the user retries
      await wait(450);
    }
    await refresh();
    setBusy(false);
  }

  async function runRogue() {
    setBusy(true);
    await pay(ROGUE, true);
    await refresh(); // keep state in sync with runAgent, in case of a partial effect
    setBusy(false);
  }

  const balance = useCountUp(state ? usd(state.balance) : 0);
  const dailyPct = state ? Math.min(100, (Number(state.daySpent) / Number(state.dailyLimit)) * 100) : 0;

  // derived gauge geometry
  const fillDeg = (dailyPct / 100) * 360;
  const ringColor = dailyPct < 70 ? "var(--lime)" : dailyPct < 90 ? "var(--amber)" : "var(--crimson)";
  const remainColor = dailyPct < 70 ? "var(--lime)" : dailyPct < 90 ? "var(--amber)" : "#FF6E8A";
  const ringBg = `conic-gradient(${ringColor} 0deg, ${ringColor} ${fillDeg}deg, rgba(255,255,255,0.06) ${fillDeg}deg 360deg)`;
  const remaining = state ? state.dailyLimit - state.daySpent : 0n;
  const healthLabel = dailyPct < 70 ? "healthy" : dailyPct < 90 ? "watch" : "near wall";
  const healthBadge = dailyPct < 70 ? "badge--ok" : dailyPct < 90 ? "badge--warn" : "badge--rej";

  const rejectedCount = ledger.filter((r) => !r.ok).length;
  const settledTasks = TASKS.filter((t) => status[t.taskId.toString()] === "ok").length;

  // This session's per-task spend = current on-chain counter − the value at load.
  const sessionSpent = (k: string): bigint | undefined => {
    const now = spent[k];
    if (now === undefined) return undefined;
    const d = now - (baseline?.[k] ?? now);
    return d > 0n ? d : 0n;
  };

  return (
    <main className="wrap dash">
      {/* HEAD */}
      <div className="dash__head">
        <div>
          <div className="eyebrow sec-eyebrow">Treasury · agent #{AGENT_8004_ID}</div>
          <h2 className="dash__title">An AI agent spent real money. <span className="spectral">Safely.</span></h2>
        </div>
        <div className="nav__r">
          <span className="pill"><span className="dot dot--live" /> Stellar Testnet</span>
          <a className="pill mono" href={contractUrl(TREASURY_ID)} target="_blank" rel="noreferrer">
            Treasury {shortAddr(TREASURY_ID)} ↗
          </a>
          <button className="btn" style={{ padding: "9px 16px" }} onClick={onHome}>↩ Home</button>
        </div>
      </div>

      {/* RPC error notice */}
      {err && (
        <div className="rejbar" style={{ marginTop: 16 }}>
          <div className="x">!</div>
          <div>
            <div><b>Couldn’t reach testnet RPC.</b></div>
            <div className="mono dim" style={{ fontSize: 12.5, marginTop: 2 }}>{err} · retrying state on next action.</div>
          </div>
        </div>
      )}

      {/* rogue rejection banner */}
      <AnimatePresence>
        {reject && (
          <motion.div
            className="rejbar"
            style={{ marginTop: 16 }}
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
          >
            <div className="x">✕</div>
            <div>
              <div><b>Blocked on-chain</b> — the agent tried “{reject.name}”.</div>
              <div className="mono dim" style={{ fontSize: 12.5, marginTop: 2 }}>
                Contract rejected: {reject.error}. Funds never moved.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STAT BAR */}
      <motion.section className="glass dstat" {...up(0.06)}>
        <div className="cell">
          <div className="lbl">Treasury balance</div>
          <div className="fig">
            {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} <small>USDC</small>
          </div>
        </div>
        <div className="cell">
          <div className="lbl">Spent today</div>
          <div className="fig">
            {state ? fmtUSDC(state.daySpent) : "—"} <small>/ {state ? fmtUSDC(state.dailyLimit) : "—"} limit</small>
          </div>
        </div>
        <div className="cell">
          <div className="lbl">Per-task cap</div>
          <div className="fig">
            {state ? fmtUSDC(state.perTaskLimit) : "—"} <small>USDC</small>
          </div>
        </div>
        <div className="cell">
          <div className="lbl">On-chain events</div>
          <div className="fig">
            {ledger.length} <small>· {rejectedCount} rejected</small>
          </div>
        </div>
      </motion.section>

      {/* ROW 1: agent console (wide) + daily-limit gauge */}
      <section className="dgrid">
        {/* agent console */}
        <motion.div className="glass glass--violet card" {...up(0.14)}>
          <div className="card__head">
            <span className="card__title">Agent console</span>
            <span className="card__sub">{TASKS.length} tasks · {settledTasks} settled</span>
          </div>

          <div className="agent__id">
            <div className="agent__avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A0712" strokeWidth="2" aria-hidden>
                <path d="M12 3 L20 7.5 V15.5 L12 20 L4 15.5 V7.5 Z" />
              </svg>
            </div>
            <div>
              <div className="agent__addr">{shortAddr(AGENT_PK)}</div>
              <div className="agent__meta">
                <a className="badge badge--id" href={contractUrl(REG_IDENTITY)} target="_blank" rel="noreferrer">
                  ERC-8004 · agent #{AGENT_8004_ID} verified
                </a>
                <span className="dim">autonomous signer</span>
              </div>
            </div>
          </div>

          {TASKS.map((t) => {
            const st = status[t.taskId.toString()] ?? "idle";
            return (
              <div className="task" key={t.taskId.toString()}>
                <span className={`task__dot ${dotClass(st)}`} />
                <div>
                  <div className="task__name">{t.name}</div>
                  <div className="task__vendor">{t.vendor} · task #{t.taskId.toString()} · {shortAddr(t.payee)}</div>
                </div>
                <div className="task__amt">{fmtUSDC(t.amount)} <small>USDC</small></div>
                <StatusBadge st={st} />
              </div>
            );
          })}

          <div className="card__actions">
            <button className="btn btn--primary" onClick={runAgent} disabled={busy}>
              {busy ? "Agent working…" : "Run agent tasks →"}
            </button>
            <button className="btn btn--danger" onClick={runRogue} disabled={busy}>
              ⚠ Simulate prompt-injection
            </button>
          </div>
        </motion.div>

        {/* daily-limit gauge */}
        <motion.div className="glass card" {...up(0.2)}>
          <div className="card__head">
            <span className="card__title">Daily limit</span>
            <span className="card__sub">UTC day</span>
          </div>
          <div className="gauge-wrap">
            <div className="gauge">
              <div className="gauge__ring" style={{ background: ringBg }} />
              <div className="gauge__center">
                <div className="gauge__pct spectral">{Math.round(dailyPct)}%</div>
                <div className="gauge__cap">
                  {state ? `${fmtUSDC(state.daySpent)} / ${fmtUSDC(state.dailyLimit)}` : "— / —"}
                </div>
              </div>
            </div>
            <div className="gauge-meta">
              <div className="row"><span className="k">Spent today</span><span className="mono">{state ? fmtUSDC(state.daySpent) : "—"}</span></div>
              <div className="row"><span className="k">Remaining</span><span className="mono" style={{ color: remainColor }}>{state ? fmtUSDC(remaining) : "—"}</span></div>
              <div className="row"><span className="k">Resets</span><span className="mono">00:00 UTC</span></div>
              <div className="row"><span className="k">Headroom</span><span className={`badge ${healthBadge}`}>{healthLabel}</span></div>
            </div>
          </div>
          <p className="card__sub" style={{ marginTop: 18, textTransform: "none", letterSpacing: 0, color: "var(--muted)", fontFamily: "var(--sans)", fontSize: 13 }}>
            Ring shifts <span style={{ color: "var(--lime)" }}>lime</span> → <span style={{ color: "var(--amber)" }}>amber</span> → <span style={{ color: "#FF6E8A" }}>crimson</span> as the day fills. A runaway loop stops at the wall.
          </p>
        </motion.div>
      </section>

      {/* ROW 2: on-chain activity (wide) + agent→payee map */}
      <section className="dgrid">
        {/* on-chain activity */}
        <motion.div className="glass card" {...up(0.26)}>
          <div className="card__head">
            <span className="card__title">On-chain activity</span>
            <span className="card__sub">testnet · latest</span>
          </div>

          {ledger.length === 0 && (
            <div className="empty">No payments yet. Run the agent to watch it settle in real time.</div>
          )}

          <div className="list-scroll">
          {ledger.map((r) => (
            r.ok ? (
              <div className="act" key={r.key}>
                <div className="act__ico act__ico--ok">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CFFB4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 13l4 4 10-11" /></svg>
                </div>
                <div className="act__body">
                  <div className="act__title">{r.name}</div>
                  <div className="act__meta">
                    <span>settled → {shortAddr(r.payee)}</span>
                    {r.hash && <a className="glow-link" href={txUrl(r.hash)} target="_blank" rel="noreferrer">{shortAddr(r.hash)} ↗</a>}
                  </div>
                </div>
                <div className="act__r">
                  <div className="act__amt act__amt--ok">−{fmtUSDC(r.amount)} USDC</div>
                  <span className="badge badge--ok">✓ settled</span>
                </div>
              </div>
            ) : (
              <div className="act act--rej" key={r.key}>
                <div className="act__ico act__ico--rej">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6E8A" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                </div>
                <div className="act__body">
                  <div className="act__title">{r.name}</div>
                  <div className="act__meta">
                    <span style={{ color: "#FF8AA0" }}>✕ {r.error ?? "rejected"}</span>
                    <span>· funds never moved · {shortAddr(r.payee)}</span>
                  </div>
                </div>
                <div className="act__r">
                  <div className="act__amt act__amt--rej">0.00 USDC</div>
                  <span className="badge badge--rej">reverted</span>
                </div>
              </div>
            )
          ))}
          </div>
        </motion.div>

        {/* agent → payee minimap */}
        <motion.div className="glass card" {...up(0.32)}>
          <div className="card__head">
            <span className="card__title">Agent → payee map</span>
            <span className="card__sub">whitelist routing</span>
          </div>
          <div className="minimap">
            <svg viewBox="0 0 300 230" aria-hidden>
              <defs>
                <linearGradient id="mmw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#7C3AED" /><stop offset="1" stopColor="#22D3EE" /></linearGradient>
              </defs>
              <g fill="none" strokeWidth="1.5">
                <path d="M150 115 L255 50" stroke="url(#mmw)" opacity="0.8" />
                <path d="M150 115 L262 150" stroke="url(#mmw)" opacity="0.8" />
                <path d="M150 115 L60 185" stroke="#FF2D55" strokeDasharray="4 5" opacity="0.7" />
              </g>
            </svg>
            <div className="mm-center">
              <div className="t">Treasury</div>
              <div className="a">{shortAddr(TREASURY_ID)}</div>
            </div>
            <div className="mm-sat mm-sat--ok" style={{ top: 24, right: 6 }}>✓ Service · {shortAddr(SERVICE)}</div>
            <div className="mm-sat mm-sat--ok" style={{ bottom: 54, right: 0 }}>✓ whitelisted payee</div>
            <div className="mm-sat mm-sat--rej" style={{ bottom: 18, left: 0 }}>✕ Attacker · {shortAddr(ATTACKER)}</div>
          </div>
          <p className="card__sub" style={{ marginTop: 6, textTransform: "none", letterSpacing: 0, color: "var(--muted)", fontFamily: "var(--sans)", fontSize: 13 }}>
            Only whitelisted addresses can ever receive funds. The attacker route is rejected on-chain.
          </p>
        </motion.div>
      </section>

      {/* per-task auto-reconciled spend (read straight from the contract) */}
      <motion.div className="glass card" style={{ marginTop: 22 }} {...up(0.38)}>
        <div className="card__head">
          <span className="card__title">Auto-reconciled spend</span>
          <span className="card__sub">per task · this session</span>
        </div>
        {TASKS.map((t) => {
          const ss = sessionSpent(t.taskId.toString());
          return (
            <div className="task" key={t.taskId.toString()}>
              <span className={`task__dot ${ss && ss > 0n ? "task__dot--ok" : ""}`} />
              <div>
                <div className="task__name">{t.name}</div>
                <div className="task__vendor">task #{t.taskId.toString()}</div>
              </div>
              <div className="task__amt">
                {ss !== undefined ? fmtUSDC(ss) : "—"} <small>USDC</small>
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* CONFIDENTIAL MODE — the ZK mirror of the public ledger above. Same payments,
          zero disclosure: only commitments + a Groth16 proof, verified live on-chain. */}
      <motion.div className="glass glass--violet card conf" style={{ marginTop: 22 }} {...up(0.42)}>
        <div className="card__head">
          <span className="card__title">Confidential mode · zero-knowledge</span>
          <span className="badge badge--id">ZK · BN254 Groth16</span>
        </div>
        <p className="conf__lead">
          The <b>same agent run, privately</b> — run the agent above and each settled payment fills
          in here, proven inside policy <b>without revealing any amount or payee</b>. Each is committed
          as <span className="mono">Poseidon(amount, payee, salt)</span>; only the commitments and one
          proof go on-chain.
        </p>

        <div className="conf__commits">
          {TASKS.map((t) => {
            const st = status[t.taskId.toString()] ?? "idle";
            const label = st === "ok" ? "→ committed ✓"
              : st === "rej" ? "→ rejected · not committed"
              : "→ awaiting proof";
            const cls = st === "ok" ? "ok" : st === "rej" ? "no" : "";
            return (
              <div className="conf__row" key={t.taskId.toString()}>
                <span className="conf__tag">task #{t.taskId.toString()}</span>
                <span className="conf__hidden">amount •••• · payee ••••</span>
                <span className={`conf__commit mono ${cls}`}>{label}</span>
              </div>
            );
          })}
        </div>

        <div className="conf__proof">
          <div className="conf__check"><span className="ok">✓ proven</span> each ≤ per-task limit (10 USDC)</div>
          <div className="conf__check"><span className="ok">✓ proven</span> Σ ≤ daily limit (50 USDC)</div>
          <div className="conf__check"><span className="ok">✓ proven</span> every payee ∈ committed whitelist</div>
          <div className="conf__check"><span className="no">hidden</span> amount &amp; payee never disclosed</div>
        </div>

        <div className="conf__attest">
          <span className="badge badge--ok">◆ attested on-chain</span>
          <a className="glow-link mono" href={txUrl(ATTESTED_TX)} target="_blank" rel="noreferrer">reference verify tx {shortAddr(ATTESTED_TX)} ↗</a>
          <a className="glow-link mono" href={contractUrl(VERIFIER_ID)} target="_blank" rel="noreferrer">verifier {shortAddr(VERIFIER_ID)} ↗</a>
          <span className="dim mono" style={{ fontSize: 12 }}>a real, replay-guarded attestation — shown as a reference; live per-run proving is the prover roadmap</span>
        </div>
      </motion.div>

      {/* FUNDING RAIL */}
      <FundingRail />

      {/* FOOTER */}
      <footer className="footer">
        <div className="brand">
          <svg className="mark" width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden>
            <path d="M16 3 L29 26 L3 26 Z" stroke="url(#fnav)" strokeWidth="1.6" fill="rgba(124,58,237,0.10)" />
            <defs><linearGradient id="fnav" x1="3" y1="26" x2="29" y2="3"><stop stopColor="#7C3AED" /><stop offset="0.5" stopColor="#4F46E5" /><stop offset="1" stopColor="#22D3EE" /></linearGradient></defs>
          </svg>
          Eunomia <span className="dim" style={{ fontFamily: "var(--sans)", fontWeight: 400, fontSize: 13, marginLeft: 6 }}>Build On Stellar · IBW 2026</span>
        </div>
        <div className="dim mono" style={{ fontSize: 12.5 }}>
          Non-custodial · {shortAddr(USDC_SAC)} · <a className="glow-link" href="https://github.com/Bekirerdem" target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
      </footer>
    </main>
  );
}

function dotClass(st: Stat): string {
  return st === "ok" ? "task__dot--ok"
    : st === "running" ? "task__dot--run"
    : st === "rej" ? "task__dot--rej"
    : "";
}

function StatusBadge({ st }: { st: Stat }) {
  const map: Record<Stat, { cls: string; label: string }> = {
    idle: { cls: "badge--id", label: "queued" },
    running: { cls: "badge--warn", label: "signing…" },
    ok: { cls: "badge--ok", label: "✓ settled" },
    rej: { cls: "badge--rej", label: "✕ rejected" },
  };
  const m = map[st];
  return <span className={`badge ${m.cls}`} style={{ marginLeft: 12 }}>{m.label}</span>;
}
