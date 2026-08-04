// The Overview's hero: what the rules did. Each row is one decision the contract made,
// and the stripe on its left IS the decision — the same device the landing uses for its
// allowed and rejected cards, so the two surfaces say the same thing the same way.
//
// Pure display; the data (durable history + live stream) comes from useTreasuryActivity in
// the parent, which also feeds the counters, so both always agree.
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EXPLORER } from "../../config";
import type { FeedEvent } from "../../lib/events";

const SHOW = 6;

/** The verb a row leads with. The label from the feed carries the detail; this is the
 *  one word that says which way the decision went. */
function verbOf(kind: string): string {
  if (kind === "blocked") return "Blocked";
  if (kind === "paid") return "Paid";
  if (kind === "fund") return "Funded";
  if (kind === "deploy") return "Created";
  if (kind === "whitelist") return "Approved";
  if (kind === "leash") return "Leashed";
  if (kind === "revoked") return "Revoked";
  return "Recorded";
}

export default function RecentActivity({
  rows,
  freshId,
  onViewAll,
}: {
  rows: FeedEvent[];
  freshId: string | null;
  onViewAll: () => void;
}) {
  const reduce = useReducedMotion();
  const shown = rows.slice(0, SHOW);
  const blocked = rows.filter((e) => e.kind === "blocked").length;

  return (
    <section className="rules">
      <div className="rules__head">
        <h1 className="rules__title">What your rules did</h1>
        {rows.length > 0 && (
          <div className="rules__count">
            {rows.length} event{rows.length > 1 ? "s" : ""}
            {blocked > 0 && ` · ${blocked} stopped`}
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="rules__empty">
          Nothing has happened yet. Fund your treasury and send a payment — every decision
          your rules make will show up here, allowed or rejected.
        </div>
      ) : (
        <div className="rules__list">
          <AnimatePresence initial={false}>
            {shown.map((e, i) => (
              <motion.article
                key={e.id}
                layout
                className={`rules__row${
                  e.kind === "blocked" ? " rules__row--blocked" : e.kind === "paid" || e.kind === "fund" ? " rules__row--ok" : ""
                }`}
                initial={reduce ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: reduce ? 0 : Math.min(i, 4) * 0.045 }}
              >
                <div className="rules__what">
                  <span className="rules__verb">{verbOf(e.kind)}</span>
                  <span className="rules__why">{e.label}</span>
                </div>
                <div className="rules__meta">
                  <span className="rules__when">{timeAgo(e.at)}</span>
                  {e.txHash && (
                    <a
                      className="rules__tx"
                      href={`${EXPLORER}/tx/${e.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="View this transaction on the explorer"
                    >
                      ↗
                    </a>
                  )}
                </div>
                {freshId === e.id && !reduce && (
                  <motion.span
                    aria-hidden
                    style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none" }}
                    initial={{ background: "rgba(166,32,33,0.18)" }}
                    animate={{ background: "rgba(166,32,33,0)" }}
                    transition={{ duration: 1.1 }}
                  />
                )}
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}

      {rows.length > SHOW && (
        <button className="rules__all" onClick={onViewAll} type="button">
          See every decision
        </button>
      )}
    </section>
  );
}

function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
