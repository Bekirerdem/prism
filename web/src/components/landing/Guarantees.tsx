/** The four checks, in plain language. The old page called this "guardrails" and listed
 *  contract internals; the mechanics moved to the docs.
 *
 *  This was a `sliders-13` shape slideshow and it worked against the section's only argument.
 *  The point here is that the four caps are *cumulative* — a per-payment cap on its own can be
 *  drained by repetition. A carousel shows one at a time, so the reader never sees the set that
 *  the argument is about. They are laid out together now, with that sentence as the closing
 *  statement rather than a footnote. */
const ITEMS = [
  {
    n: "01",
    t: "A cap per payment",
    d: "No single payment can exceed the amount you set — whatever the agent was told to do.",
  },
  {
    n: "02",
    t: "A cap per day",
    d: "Refills on a rolling 24-hour window, not at midnight. There is no hour where the limit doubles.",
  },
  {
    n: "03",
    t: "Approved payees only",
    d: "An address you never approved is refused. A convincing prompt does not change that.",
  },
  {
    n: "04",
    t: "Revoke instantly",
    d: "Cut the agent's authority in one transaction. It stops being able to spend immediately.",
  },
];

export default function Guarantees() {
  return (
    <section className="lp__section lp__divide" id="guarantees">
      <div className="lp__in">
        <h2 className="lp__reveal--head">Four things the chain enforces</h2>
        <p className="lp__lede lp__reveal">
          Not settings in an app that an agent could be talked around. Rules the contract checks
          before it moves money.
        </p>

        <div className="lp__guards">
          {ITEMS.map((it) => (
            <article className="lp__guard" key={it.n}>
              <span className="lp__guard-n">{it.n}</span>
              <h3 className="lp__guard-t">{it.t}</h3>
              <p className="lp__guard-d">{it.d}</p>
            </article>
          ))}
        </div>

        {/* The whole reason this section exists — the one line a competitor cannot copy. */}
        <div className="lp__guard-key">
          <p>
            A cap on each payment alone can be emptied by repeating small payments.{" "}
            <strong>These caps add up across the day.</strong> That difference is the product.
          </p>
          <a className="lp__link" href="/docs/contracts">
            Contract mechanics →
          </a>
        </div>
      </div>
    </section>
  );
}
