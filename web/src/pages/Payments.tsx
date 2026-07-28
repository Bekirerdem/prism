// Payments: sending money and managing who can receive it, in one place. The Send form
// shows the policy context LIVE (per-payment cap + what's left today) before the wallet
// ever opens; the contract still has the final word — a BLOCKED result is the product
// working, not a failure. Payees are derived from chain events + the device book, each
// row verifiable on-chain via is_payee.
import { useCallback, useEffect, useMemo, useState } from "react";
import { EXPLORER, fmtXlm, SERVICE, shortAddr } from "../config";
import { useTreasury } from "../state/useTreasury";
import { walletSignerFor } from "../lib/walletKit";
import { isPayee, makeTreasury } from "../lib/userTreasury";
import { isValidPaymentDest } from "../lib/validate";
import { loadLedger } from "../lib/eventLedger";
import { loadPayeeBook, mergePayees, payeesFromEvents, rememberPayee, forgetPayee, type PayeeEntry } from "../lib/payees";
import { fetchActivityHistory, mergeFeedEvents, subscribeActivity } from "../lib/activity";
import { filterFeed, kindColor } from "../lib/feedFilter";
import type { FeedEvent } from "../lib/events";

type Tab = "send" | "payees";
type Verify = Record<string, boolean | undefined>; // address -> on-chain whitelist truth

export default function Payments() {
  const t = useTreasury();
  const treasuryId = t.treasuryId as string;
  const [tab, setTab] = useState<Tab>("send");

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
    if (!t.address || payees.length === 0) return;
    let alive = true;
    const client = makeTreasury(treasuryId, t.address, walletSignerFor(t.address));
    (async () => {
      for (const p of payees) {
        try {
          const ok = await isPayee(client, p.address);
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
    <div style={wrap}>
      <div style={tabs}>
        <button style={tab === "send" ? tabActive : tabBtn} onClick={() => setTab("send")} type="button">
          Send
        </button>
        <button style={tab === "payees" ? tabActive : tabBtn} onClick={() => setTab("payees")} type="button">
          Payees {payees.length > 0 ? `(${payees.length})` : ""}
        </button>
      </div>

      {tab === "send" ? (
        <>
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
                or whitelist one in the Payees tab.
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
              <div style={{ ...hint, color: overPerTask || overDaily ? "#E0A106" : "#7C7C92" }}>
                per-payment ≤ {fmtXlm(s.perTaskLimit)} XLM · {remaining !== null ? fmtXlm(remaining) : "—"} XLM left
                today
                {overPerTask && " — above the per-payment cap; the contract will block it"}
                {!overPerTask && overDaily && " — above what's left today; the contract will block it"}
              </div>
            )}

            <div style={signerRow}>
              <span
                style={{
                  ...signerChip,
                  color: t.sessionActive ? "#E0A106" : "#7C7C92",
                  borderColor: t.sessionActive ? "rgba(224,161,6,0.45)" : "rgba(255,255,255,0.12)",
                }}
              >
                {t.sessionActive ? "⚡ agent session signs — no popup" : "wallet signs"}
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

          <div style={{ ...label, margin: "20px 0 8px" }}>Payment history</div>
          {paymentRows.length === 0 ? (
            <div style={hint}>No payments yet.</div>
          ) : (
            <div style={card}>
              {paymentRows.map((e) => (
                <div key={e.id} style={histRow}>
                  <span style={{ ...dot, background: kindColor(e.kind), boxShadow: `0 0 6px ${kindColor(e.kind)}66` }} />
                  <span style={histLabel}>{e.label}</span>
                  <span style={{ ...histBadge, color: e.kind === "blocked" ? "#FF5D5D" : "#00FF43" }}>
                    {e.kind === "blocked" ? "BLOCKED" : "settled ✓"}
                  </span>
                  {e.txHash && (
                    <a style={txLink} href={`${EXPLORER}/tx/${e.txHash}`} target="_blank" rel="noreferrer">
                      ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={card}>
          {payees.length === 0 ? (
            <div style={hint}>No payees yet — whitelist an address to start paying it.</div>
          ) : (
            payees.map((p) => (
              <div key={p.address} style={histRow}>
                <span style={{ ...mono, flex: 1 }}>{shortAddr(p.address)}</span>
                {p.addedAt && <span style={when}>added {p.addedAt.slice(5, 10)}</span>}
                <span
                  style={{
                    ...histBadge,
                    color: verify[p.address] === true ? "#00FF43" : verify[p.address] === false ? "#7C7C92" : "#5C5C6E",
                  }}
                >
                  {verify[p.address] === true
                    ? "verified ✓"
                    : verify[p.address] === false
                      ? "not on whitelist"
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
      )}
    </div>
  );
}

const wrap: React.CSSProperties = { maxWidth: 640, margin: "0 auto" };
const tabs: React.CSSProperties = { display: "flex", gap: 6, marginBottom: 14 };
const tabBtn: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 100, cursor: "pointer", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit",
  background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "#A0A0B8",
};
const tabActive: React.CSSProperties = {
  ...tabBtn, background: "rgba(253,218,36,0.12)", border: "1px solid rgba(253,218,36,0.4)", color: "#FDDA24",
};
const card: React.CSSProperties = {
  padding: 18, borderRadius: 14,
  background: "rgba(18,18,28,0.6)", border: "1px solid rgba(255,255,255,0.08)",
};
const label: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#7C7C92" };
const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 8, padding: "11px 13px", borderRadius: 10,
  background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEDF4",
};
const primaryBtn: React.CSSProperties = {
  marginTop: 14, padding: "12px 18px", borderRadius: 11, border: "none", cursor: "pointer",
  background: "#FDDA24", color: "#0F0F0F", fontWeight: 600, fontSize: 14.5, fontFamily: "inherit",
};
const hint: React.CSSProperties = { marginTop: 8, fontSize: 12, color: "#7C7C92", lineHeight: 1.5 };
const warn: React.CSSProperties = { marginTop: 8, fontSize: 12, color: "#E0A106" };
const inlineErr: React.CSSProperties = { marginTop: 8, fontSize: 12.5, color: "#FF5D5D" };
const inlineLink: React.CSSProperties = {
  background: "none", border: "none", padding: 0, cursor: "pointer",
  color: "#A0A0B8", textDecoration: "underline", font: "inherit", fontSize: 12,
};
const signerRow: React.CSSProperties = { marginTop: 12 };
const signerChip: React.CSSProperties = {
  fontSize: 12, padding: "4px 10px", borderRadius: 100, border: "1px solid", background: "rgba(0,0,0,0.25)",
};
const histRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "9px 2px", fontSize: 13, color: "#EDEDF4" };
const histLabel: React.CSSProperties = { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const histBadge: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, flex: "0 0 auto" };
const dot: React.CSSProperties = { width: 7, height: 7, borderRadius: "50%", flex: "0 0 auto" };
const txLink: React.CSSProperties = { color: "#A0A0B8", textDecoration: "none", fontSize: 12 };
const mono: React.CSSProperties = { fontFamily: "ui-monospace, monospace", fontSize: 13 };
const when: React.CSSProperties = { color: "#7C7C92", fontSize: 11.5 };
const removeBtn: React.CSSProperties = {
  background: "none", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 7, cursor: "pointer",
  color: "#A0A0B8", fontSize: 11.5, padding: "3px 9px",
};
