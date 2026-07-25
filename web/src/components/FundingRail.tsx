import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { muxedFor, sendDeposit, readDeposits, type Deposit } from "../lib/muxed";
import { AGENT_PK, BUDGETS, POOL_PK, shortAddr, txUrl, contractUrl } from "../config";

const EASE = [0.2, 0.7, 0.3, 1] as const;

export default function FundingRail() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [fundErr, setFundErr] = useState<string | null>(null);

  async function refresh() {
    try { setDeposits(await readDeposits()); } catch { /* offline — ignore */ }
  }
  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, []);

  async function fund(id: bigint) {
    setBusy(id.toString()); setFundErr(null);
    try {
      const hash = await sendDeposit(id);
      // Horizon indexes the new payment a few seconds late, so re-reading immediately
      // returned the PREVIOUS deposit (an off-by-one that mislabelled the budget). The
      // deposit is real once sendDeposit resolves — attribute it optimistically by the
      // funded id; the next mount/refresh reconciles from Horizon.
      setDeposits((prev) => [
        { budgetId: id.toString(), amount: "5.0000000", from: AGENT_PK, hash },
        ...prev.filter((d) => d.hash !== hash),
      ]);
    } catch (e) { console.error(e); setFundErr("Network busy — try funding again in a moment."); }
    setBusy(null);
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400);
  }

  const nameFor = (id: string) => BUDGETS.find((b) => b.id.toString() === id)?.name ?? `Budget #${id}`;

  const last = deposits[0];

  return (
    <motion.section
      className="dgrid"
      style={{ gridTemplateColumns: "1fr 1fr" }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      {/* LEFT — funding rail: budget list + Fund button */}
      <div className="glass card">
        <div className="card__head">
          <span className="card__title">Funding rail</span>
          <span className="card__sub">muxed sub-addresses</span>
        </div>
        <p
          className="card__sub"
          style={{
            textTransform: "none", letterSpacing: 0, color: "var(--muted)",
            fontFamily: "var(--sans)", fontSize: 13, margin: "-6px 0 16px",
          }}
        >
          One pool account, zero-cost{" "}
          <a href={contractUrl(POOL_PK)} target="_blank" rel="noreferrer">sub-addresses</a>.
          Each deposit is attributed to a budget by <code>to_muxed_id</code> — no memos, no new accounts.
        </p>

        <div className="fund__budgets">
          {BUDGETS.map((b, i) => {
            const m = muxedFor(b.id);
            const k = b.id.toString();
            return (
              <div className="budget" key={k}>
                <span className="budget__n">{i + 1}</span>
                <div>
                  <div className="budget__name">{b.name}</div>
                  <button
                    className="budget__mux"
                    onClick={() => copy(m, k)}
                    title="copy full muxed address"
                  >
                    {copied === k ? "copied ✓" : `${shortAddr(m)} · sub #${k} ⧉`}
                  </button>
                </div>
                <button
                  className="btn btn--primary budget__sel"
                  style={{ padding: "9px 16px", fontSize: 13 }}
                  disabled={busy === k}
                  onClick={() => fund(b.id)}
                >
                  {busy === k ? "funding…" : "Fund 5 XLM →"}
                </button>
              </div>
            );
          })}
        </div>
        {fundErr && (
          <p className="card__sub" style={{ marginTop: 14, textTransform: "none", letterSpacing: 0, color: "#FF8AA0", fontFamily: "var(--sans)", fontSize: 13 }}>
            {fundErr}
          </p>
        )}
      </div>

      {/* RIGHT — last deposit + attributed list */}
      <div className="glass card">
        <div className="card__head">
          <span className="card__title">Last deposit</span>
          <span className="card__sub">attributed</span>
        </div>

        {!last && (
          <div className="empty">No deposits yet. Fund a budget to see it attributed on-chain.</div>
        )}

        {last && (
          <>
            <div className="deposit">
              <div className="deposit__row">
                <div>
                  <div className="deposit__amt">+{Number(last.amount).toFixed(2)} XLM</div>
                  <div className="act__meta" style={{ marginTop: 6 }}>
                    budget #{last.budgetId} · {nameFor(last.budgetId)}
                  </div>
                </div>
                <span className="badge badge--ok">✓ confirmed</span>
              </div>
              <div className="rogue__row" style={{ borderColor: "rgba(255,255,255,0.07)", marginTop: 14 }}>
                <span className="k">from</span>
                <span className="v mono">{shortAddr(last.from)}</span>
              </div>
              <div className="rogue__row" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <span className="k">tx</span>
                <a className="v glow-link mono" href={txUrl(last.hash)} target="_blank" rel="noreferrer">
                  {shortAddr(last.hash)} ↗
                </a>
              </div>
              <div className="rogue__row" style={{ borderBottom: "none" }}>
                <span className="k">fee</span>
                <span className="v mono">&lt; $0.0001</span>
              </div>
            </div>

            {deposits.length > 1 && (
              <div className="list-scroll" style={{ marginTop: 16, maxHeight: 220 }}>
                {deposits.slice(1).map((d, i) => (
                  <div className="act" key={d.hash + i}>
                    <div className="act__ico act__ico--ok">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CFFB4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4 10-11" /></svg>
                    </div>
                    <div className="act__body">
                      <div className="act__title">{nameFor(d.budgetId)}</div>
                      <div className="act__meta">
                        budget #{d.budgetId} · {shortAddr(d.from)} ·{" "}
                        <a className="glow-link" href={txUrl(d.hash)} target="_blank" rel="noreferrer">{shortAddr(d.hash)} ↗</a>
                      </div>
                    </div>
                    <div className="act__r">
                      <div className="act__amt act__amt--ok">+{Number(d.amount).toFixed(2)} XLM</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </motion.section>
  );
}
