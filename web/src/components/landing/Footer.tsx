import { TRACTION } from "./traction";

export default function Footer() {
  return (
    <footer className="lp__footer">
      <div className="lp__in">
        <div className="lp__footer-row">
          <strong style={{ fontFamily: "Questrial, sans-serif", fontSize: 18 }}>Eunomia</strong>
          <a className="lp__link" href="/docs/">
            Docs
          </a>
          <a
            className="lp__link"
            href="https://github.com/eunomia-finance/eunomia"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
          <span className="lp__badge">Stellar Testnet</span>
        </div>
        <p style={{ marginTop: 18, lineHeight: 1.6 }}>
          Open source, every line readable. {TRACTION.treasuries} treasuries created and{" "}
          {TRACTION.blocked} out-of-policy attempts stopped — all verifiable on-chain.
        </p>
      </div>
    </footer>
  );
}
