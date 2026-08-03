/** The four checks, in plain language. The old page called this "guardrails" and listed
 *  contract internals; the mechanics moved to the docs.
 *
 *  Presented as the `sliders-13` shape slideshow (`Sliders/13`): one guarantee at a time, the
 *  panel behind it clipped to a circle that contracts on the way out and opens on the way in,
 *  the copy staggering after it. The reference clips a photograph; here the clip runs on a
 *  flat panel and the text sits above it, so nothing is ever cut off mid-word.
 *
 *  Markup only — the timeline lives in `useReveal`, next to the other adapted mechanics. */
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

        <div className="lp__slides" data-slides>
          {ITEMS.map((it, i) => (
            <article
              className={`lp__slide${i === 0 ? " lp__slide--current" : ""}`}
              key={it.t}
              aria-hidden={i === 0 ? undefined : "true"}
            >
              <div className="lp__slide-shape">
                <i className="lp__slide-fill" />
              </div>
              <div className="lp__slide-body">
                <span className="lp__slide-n">{`0${i + 1}`}</span>
                <h3 className="lp__slide-t">{it.t}</h3>
                <p className="lp__slide-d">{it.d}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="lp__slide-nav">
          <button className="lp__slide-btn" data-slide-prev aria-label="Previous guarantee">
            ←
          </button>
          <span className="lp__slide-count" data-slide-count>
            01 / 0{ITEMS.length}
          </span>
          <button className="lp__slide-btn" data-slide-next aria-label="Next guarantee">
            →
          </button>
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
