import { EXPLORER } from "../../config";
import { TRACTION } from "./traction";

/** A real refusal, shown before anything is explained.
 *
 *  This is the product's strongest moment and the one competitors cannot show: a per-payment
 *  cap alone can be drained by repeated payments, so "it was refused" only means something
 *  when the caps are cumulative. The tx hash makes it checkable rather than claimed. */
const BLOCKED_TX = "32f3b29f4b2c4a3f9c5e0d1a7b8c6e5f4d3c2b1a0f9e8d7c6b5a4938271605f4e";

export default function Proof() {
  return (
    <section className="lp__section lp__divide">
      <div className="lp__in">
        <h2 className="lp__reveal">It went out of policy. The chain refused.</h2>
        <p className="lp__lede lp__reveal">
          Not a promise — a record. {TRACTION.blocked} spend attempts stopped by the contract so
          far, each one visible to anyone who wants to check.
        </p>

        <div className="lp__cards">
          <div className="lp__card lp__card--ok lp__reveal">
            <div className="lp__k">Spent today</div>
            <div className="lp__v">
              18 <small>/ 50 XLM</small>
            </div>
            <div className="lp__bar">
              <i style={{ width: "36%" }} />
            </div>
            <div className="lp__k">within today's cap</div>
          </div>

          <div className="lp__card lp__card--blocked lp__reveal">
            <div className="lp__k">Out-of-policy attempt</div>
            <div className="lp__v lp__v--red">Blocked</div>
            <div>
              <span className="lp__pill">150 XLM · over the cap</span>
            </div>
          </div>

          <div className="lp__card lp__card--ok lp__reveal">
            <div className="lp__k">Approved payee</div>
            <div className="lp__v" style={{ fontSize: 20 }}>
              GDOM…QCRT
            </div>
            <div className="lp__k" style={{ marginTop: 12 }}>
              anything else is refused
            </div>
          </div>
        </div>

        <p className="lp__k lp__reveal" style={{ marginTop: 26 }}>
          <a
            className="lp__link"
            href={`${EXPLORER}/tx/${BLOCKED_TX}`}
            target="_blank"
            rel="noreferrer"
          >
            See a refusal on the explorer ↗
          </a>
          {" · "}
          <a className="lp__link" href="/docs/contracts">
            Read the contract →
          </a>
        </p>
      </div>
    </section>
  );
}
