/** The four checks, in plain language. The old page called this "guardrails" and listed
 *  contract internals; the mechanics moved to the docs. */
const ITEMS = [
  {
    t: "A cap per payment",
    d: "No single payment can exceed the amount you set — whatever the agent was told to do.",
  },
  {
    t: "A cap per day",
    d: "Refills on a rolling 24-hour window, not at midnight. There is no hour where the limit doubles.",
  },
  {
    t: "Approved payees only",
    d: "An address you never approved is refused. A convincing prompt does not change that.",
  },
  {
    t: "Revoke instantly",
    d: "Cut the agent's authority in one transaction. It stops being able to spend immediately.",
  },
];

export default function Guarantees() {
  return (
    <section className="lp__section lp__divide">
      <div className="lp__in">
        <h2 className="lp__reveal--head">Four things the chain enforces</h2>
        <p className="lp__lede lp__reveal">
          Not settings in an app that an agent could be talked around. Rules the contract checks
          before it moves money.
        </p>

        <div className="lp__cards">
          {ITEMS.map((it) => (
            <div className="lp__card lp__card--ok lp__reveal" key={it.t}>
              <div className="lp__v" style={{ fontSize: 19, marginBottom: 8 }}>
                {it.t}
              </div>
              <p className="lp__k" style={{ marginBottom: 0, lineHeight: 1.55 }}>
                {it.d}
              </p>
            </div>
          ))}
        </div>

        {/* The whole reason this section exists — the one line a competitor cannot copy. */}
        <div className="lp__note lp__reveal">
          A cap on each payment alone can be emptied by repeating small payments. These caps add
          up across the day. That difference is the product.
        </div>

        <p className="lp__k lp__reveal" style={{ marginTop: 24 }}>
          <a className="lp__link" href="/docs/contracts">
            Contract mechanics →
          </a>
        </p>
      </div>
    </section>
  );
}
