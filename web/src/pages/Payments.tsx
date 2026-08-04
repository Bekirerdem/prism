// Payments: sending money and managing who can receive it, in one place. The Send form
// shows the policy context LIVE (per-payment cap + what's left today) before the wallet
// ever opens; the contract still has the final word — a BLOCKED result is the product
// working, not a failure. Payees are derived from chain events + the device book, each
// row verifiable on-chain via is_payee.
import { useCallback, useEffect, useMemo, useState } from "react";
import { EXPLORER, fmtXlm, SERVICE, shortAddr } from "../config";
import { useTreasury } from "../state/useTreasury";
import { executorFor } from "../lib/walletKit";
import { isPayee, makeTreasury } from "../lib/userTreasury";
import { isValidPaymentDest } from "../lib/validate";
import { loadLedger } from "../lib/eventLedger";
import { loadPayeeBook, mergePayees, payeesFromEvents, rememberPayee, forgetPayee, type PayeeEntry } from "../lib/payees";
import { fetchActivityHistory, mergeFeedEvents, subscribeActivity } from "../lib/activity";
import { filterFeed, kindColor } from "../lib/feedFilter";
import type { FeedEvent } from "../lib/events";

type Verify = Record<string, boolean | undefined>; // address -> on-chain whitelist truth

export default function Payments() {
  const t = useTreasury();
  const treasuryId = t.treasuryId as string;

  // ---- payee list (derived, no state: refreshKey bumps after every action) -------
  const [verify, setVerify] = useState<Verify>({});
  const [payeeBump, setPayeeBump] = useState(0); // optimistic re-derive right after add/remove
  const payees = useMemo<PayeeEntry[]>(
    () => mergePayees(payeesFromEvents(loadLedger(treasuryId)), loadPayeeBook(treasuryId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshKey/payeeBump invalidate the localStorage-backed derivation
    [treasuryId, t.refreshKey, payeeBump],
  );
  const reloadPayees = useCallback(() => setPayeeBump((b) => b + 1), []);

  // Verify each derived row against the chain (read-only simulate; no signatures).
  useEffect(() => {
    const addr = t.address;
    if (!addr || payees.length === 0) return;
    let alive = true;
    (async () => {
      const treasury = makeTreasury(treasuryId, await executorFor(addr));
      for (const p of payees) {
        try {
          const ok = await isPayee(treasury, p.address);
          if (!alive) return;
          setVerify((v) => ({ ...v, [p.address]: ok }));
        } catch {
          /* RPC hiccup — leave the badge unknown */
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [payees, t.address, treasuryId]);

  // ---- send form ----------------------------------------------------------------
  const [payTo, setPayTo] = useState("");
  const [payAmt, setPayAmt] = useState("");
  const [sendErr, setSendErr] = useState("");

  const s = t.state;
  const remaining = s ? (s.dailyLimit > s.daySpent ? s.dailyLimit - s.daySpent : 0n) : null;
  const amtNum = Number(payAmt);
  const overPerTask = s && Number.isFinite(amtNum) && amtNum > Number(s.perTaskLimit) / 1e7;
  const overDaily = remaining !== null && Number.isFinite(amtNum) && amtNum > Number(remaining) / 1e7;
  const destLooksOff = payTo.trim() !== "" && !isValidPaymentDest(payTo);

  const doSend = async () => {
    setSendErr("");
    if (payTo.trim().startsWith("C")) {
      setSendErr("Contract addresses can't receive payments — use a G… account address.");
      return;
    }
    const res = await t.spend(payTo, payAmt);
    if (res.ok) setPayAmt("");
    else if (res.validation) setSendErr(res.msg);
  };

  // ---- add / remove payee -------------------------------------------------------
  const [newPayee, setNewPayee] = useState("");
  const [payeeErr, setPayeeErr] = useState("");

  const doAdd = async () => {
    setPayeeErr("");
    const addr = newPayee.trim();
    const res = await t.whitelist(addr);
    if (res.ok) {
      rememberPayee(treasuryId, addr);
      setNewPayee("");
      reloadPayees();
      setVerify((v) => ({ ...v, [addr]: true })); // optimistic — the tx just confirmed it
    } else if (res.validation) {
      setPayeeErr(res.msg);
    }
  };

  const doRemove = async (addr: string) => {
    const res = await t.removePayeeAddr(addr);
    if (res.ok) {
      forgetPayee(treasuryId, addr);
      reloadPayees();
      setVerify((v) => ({ ...v, [addr]: false }));
    }
  };

  // ---- payment history ----------------------------------------------------------
  const [history, setHistory] = useState<FeedEvent[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const rows = await fetchActivityHistory(60);
      if (alive) setHistory(rows);
    })();
    const unsub = subscribeActivity((e) => setHistory((list) => mergeFeedEvents([e], list, 60)));
    return () => {
      alive = false;
      unsub();
    };
  }, [treasuryId, t.refreshKey]);

  const paymentRows = useMemo(
    () => filterFeed(history, { groups: new Set(["payments", "blocked"]), treasuryId }).slice(0, 12),
    [history, treasuryId],
  );

  return (
    <div className="page">
      <div className="page__main">
          <div style={card}>
            <div style={label}>To</div>
            <input
              style={input}
              list="payees-list"
              placeholder="Payee address (G…)"
              aria-label="Payment destination address"
              value={payTo}
              onChange={(e) => setPayTo(e.target.value)}
            />
            <datalist id="payees-list">
              {payees.map((p) => (
                <option key={p.address} value={p.address} />
              ))}
            </datalist>
            {destLooksOff && (
              <div style={warn}>
                {payTo.trim().startsWith("C")
                  ? "Contract addresses can't receive payments — use a G… account."
                  : "That doesn't look like a Stellar account address."}
              </div>
            )}
            {payees.length === 0 && (
              <div style={hint}>
                No payees yet —{" "}
                <button style={inlineLink} type="button" onClick={() => setPayTo(SERVICE)}>
                  use the sample vendor ({shortAddr(SERVICE)})
                </button>{" "}
                or approve one on the right.
              </div>
            )}

            <div style={{ ...label, marginTop: 14 }}>Amount</div>
            <input
              style={input}
              inputMode="decimal"
              placeholder="Amount (XLM)"
              aria-label="Payment amount in XLM"
              value={payAmt}
              onChange={(e) => setPayAmt(e.target.value)}
            />
            {s && (
              <div style={{ ...hint, color: overPerTask || overDaily ? "var(--red)" : "var(--ink-2)" }}>
                per-payment ≤ {fmtXlm(s.perTaskLimit)} XLM · {remaining !== null ? fmtXlm(remaining) : "—"} XLM left
                today
                {overPerTask && " — above your per-payment cap; it will be blocked"}
                {!overPerTask && overDaily && " — above what's left today; it will be blocked"}
              </div>
            )}

            <div style={signerRow}>
              <span
                style={{
                  ...signerChip,
                  color: t.sessionActive ? "var(--ink)" : "var(--ink-2)",
                  borderColor: t.sessionActive ? "var(--green)" : "var(--line)",
                }}
              >
                {t.sessionActive ? "⚡ the Leash signs — no popups" : "you approve each payment in your wallet"}
              </span>
            </div>

            <button
              style={{ ...primaryBtn, opacity: t.busy ? 0.6 : 1 }}
              onClick={() => void doSend()}
              disabled={!!t.busy}
              type="button"
            >
              {t.busy === "spend" ? "Sending…" : "Send payment"}
            </button>
            {sendErr && <div style={inlineErr}>{sendErr}</div>}
          </div>

          <div style={card}>
            <div style={label}>Payment history</div>
            {paymentRows.length === 0 ? (
              <div style={hint}>Nothing sent yet. Every attempt lands here, allowed or refused.</div>
            ) : (
              paymentRows.map((e) => (
                <div key={e.id} style={histRow}>
                  <span style={{ ...dot, background: kindColor(e.kind) }} />
                  <span style={histLabel}>{e.label}</span>
                  <span style={{ ...histBadge, color: e.kind === "blocked" ? "var(--red)" : "var(--ink)" }}>
                    {e.kind === "blocked" ? "BLOCKED" : "paid ✓"}
                  </span>
                  {e.txHash && (
                    <a style={txLink} href={`${EXPLORER}/tx/${e.txHash}`} target="_blank" rel="noreferrer">
                      ↗
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
      </div>

      {/* The payee list used to live behind a tab, which meant the one rule that decides
          whether a payment goes through was invisible while writing it. */}
      <div className="page__side">
        <div style={card}>
          <div style={label}>Approved payees</div>
          {payees.length === 0 ? (
            <div style={hint}>No payees yet — approve an address to start paying it.</div>
          ) : (
            payees.map((p) => (
              <div key={p.address} style={histRow}>
                <button style={{ ...mono, flex: 1, ...pickBtn }} onClick={() => setPayTo(p.address)} type="button">
                  {shortAddr(p.address)}
                </button>
                <span
                  style={{
                    ...histBadge,
                    color: verify[p.address] === true ? "var(--ink)" : verify[p.address] === false ? "var(--ink-2)" : "var(--ink-2)",
                  }}
                >
                  {verify[p.address] === true
                    ? "verified ✓"
                    : verify[p.address] === false
                      ? "not approved"
                      : "checking…"}
                </span>
                <button
                  style={{ ...removeBtn, opacity: t.busy ? 0.5 : 1 }}
                  onClick={() => void doRemove(p.address)}
                  disabled={!!t.busy}
                  type="button"
                >
                  remove
                </button>
              </div>
            ))
          )}

          <div style={{ ...label, marginTop: 16 }}>Add payee</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
            <input
              style={{ ...input, flex: 1, minWidth: 220 }}
              placeholder="Payee address (G… or C…)"
              aria-label="Payee address"
              value={newPayee}
              onChange={(e) => setNewPayee(e.target.value)}
            />
            <button
              style={{ ...primaryBtn, marginTop: 8, opacity: t.busy ? 0.6 : 1 }}
              onClick={() => void doAdd()}
              disabled={!!t.busy}
              type="button"
            >
              {t.busy === "whitelist" ? "Adding…" : "Add payee"}
            </button>
          </div>
          <div style={hint}>
            No second address handy?{" "}
            <button style={inlineLink} type="button" onClick={() => setNewPayee(SERVICE)}>
              use the sample vendor ({shortAddr(SERVICE)})
            </button>
          </div>
          {payeeErr && <div style={inlineErr}>{payeeErr}</div>}
        </div>
      </div>
    </div>
  );
}

// Clicking a payee fills the form — the list is the fastest way to address a payment, so it
// has to read as something you can press rather than as a label.
const pickBtn: React.CSSProperties = {
  background: "none", border: "none", padding: 0, cursor: "pointer",
  textAlign: "left", fontFamily: "ui-monospace, monospace",
  color: "var(--ink)", textDecoration: "underline", textUnderlineOffset: 3,
};
const card: React.CSSProperties = {
  padding: 18, borderRadius: 14,
  background: "var(--surface)", border: "1px solid var(--line)",
};
const label: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-2)" };
const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 8, padding: "11px 13px", borderRadius: 10,
  background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)",
};
const primaryBtn: React.CSSProperties = {
  marginTop: 14, padding: "12px 18px", borderRadius: 11, border: "none", cursor: "pointer",
  background: "var(--ink)", color: "var(--bg)", fontWeight: 600, fontSize: 14.5, fontFamily: "inherit",
};
const hint: React.CSSProperties = { marginTop: 8, fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 };
const warn: React.CSSProperties = { marginTop: 8, fontSize: 12, color: "var(--red)" };
const inlineErr: React.CSSProperties = { marginTop: 8, fontSize: 12.5, color: "var(--red)" };
const inlineLink: React.CSSProperties = {
  background: "none", border: "none", padding: 0, cursor: "pointer",
  color: "var(--ink-2)", textDecoration: "underline", font: "inherit", fontSize: 12,
};
const signerRow: React.CSSProperties = { marginTop: 12 };
const signerChip: React.CSSProperties = {
  fontSize: 12, padding: "4px 10px", borderRadius: 100, border: "1px solid", background: "var(--bg)",
};
const histRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "9px 2px", fontSize: 13, color: "var(--ink)" };
const histLabel: React.CSSProperties = { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const histBadge: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, flex: "0 0 auto" };
const dot: React.CSSProperties = { width: 7, height: 7, borderRadius: "50%", flex: "0 0 auto" };
const txLink: React.CSSProperties = { color: "var(--ink-2)", textDecoration: "none", fontSize: 12 };
const mono: React.CSSProperties = { fontFamily: "ui-monospace, monospace", fontSize: 13 };
const removeBtn: React.CSSProperties = {
  background: "none", border: "1px solid var(--line)", borderRadius: 7, cursor: "pointer",
  color: "var(--ink-2)", fontSize: 11.5, padding: "3px 9px",
};
