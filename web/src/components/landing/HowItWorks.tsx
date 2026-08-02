/** Three steps, one sentence each. The old page explained the machinery here (muxed
 *  sub-addresses, sponsored reserves); that moved to the docs. What stays is what the user
 *  actually does. */
const STEPS = [
  {
    n: "01",
    t: "Create a treasury",
    d: "One tap with a passkey. No wallet to install, no seed phrase to store, no XLM to buy first.",
  },
  {
    n: "02",
    t: "Set the rules",
    d: "A cap per payment, a cap per day, and the list of payees you approve. You can change them any time.",
  },
  {
    n: "03",
    t: "Let the agent spend",
    d: "It pays inside your rules — or it doesn't pay at all. Nothing you have to supervise.",
  },
];

export default function HowItWorks() {
  return (
    <section className="lp__section lp__divide">
      <div className="lp__in">
        <h2 className="lp__reveal">How it works</h2>
        <p className="lp__lede lp__reveal">
          Three things you do once. After that the contract does the watching.
        </p>

        <div className="lp__steps">
          {STEPS.map((s) => (
            <div className="lp__step lp__reveal" key={s.n}>
              <div className="lp__step-n">{s.n}</div>
              <div className="lp__step-b">
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="lp__k lp__reveal" style={{ marginTop: 24 }}>
          <a className="lp__link" href="/docs/architecture">
            How it's built →
          </a>
        </p>
      </div>
    </section>
  );
}
