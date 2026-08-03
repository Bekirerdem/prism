import { Suspense, lazy, useEffect, useState } from "react";
import { connectPasskey } from "../../lib/walletKit";
import { passkeyCapability, type PasskeyCapability } from "../../lib/passkeySupport";
import { errText } from "../../lib/wallet-errors";
import { TRACTION } from "./traction";
import Words from "./Words";

const WalletChip = lazy(() => import("../WalletChip"));

/** The brand name split so the loader box can sit in the middle of it, exactly like the
 *  reference does with "Aur|box|ela". */
const BRAND_START = "Eun";
const BRAND_END = "omia";

const loaderChars = (word: string, keyBase: string) =>
  [...word].map((ch, i) => (
    <span className="lp__load-char" key={`${keyBase}-${i}`}>
      {ch}
    </span>
  ));

/** The opening screen — a full-height scene, not a padded band.
 *
 *  Structure follows animmaster `hero-1` (`Hero Animations/1`): a `100dvh` header, a centred
 *  loader that holds the brand name with a box growing out of its middle, and the real content
 *  laid out top (nav) to bottom (headline) underneath it.
 *
 *  The reference grows a photograph out of that box until it fills the viewport and keeps it as
 *  the hero's background. There is no artwork yet, so the box carries a flat `--green` panel
 *  and pulls away once the scene is set — when the imagery lands it goes inside this same box
 *  and simply stops retracting.
 *
 *  Still no product screenshot: a dashboard image here reads as a tool demo, not a company.
 *  The counter carries the evidence instead. */
export default function Hero({
  onEnter,
  onWallet,
}: {
  onEnter: () => void;
  onWallet: () => void;
}) {
  const [capability, setCapability] = useState<PasskeyCapability>("none");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    void passkeyCapability(window).then(setCapability);
  }, []);

  const startPasskey = async () => {
    setErr("");
    setBusy(true);
    try {
      await connectPasskey("create");
      onEnter();
    } catch (e) {
      setErr(errText(e) || "Couldn't create your passkey. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="lp__section lp__hero">
      {/* The loading scene. Decorative: the same name is in the nav for assistive tech. */}
      <div className="lp__loader" aria-hidden="true">
        <div className="lp__brand-line">
          <span className="lp__brand-start">{loaderChars(BRAND_START, "s")}</span>
          <div className="lp__loader-box">
            <i className="lp__loader-fill" />
          </div>
          <span className="lp__brand-end">{loaderChars(BRAND_END, "e")}</span>
        </div>
      </div>

      <div className="lp__hero-top">
        <nav className="lp__nav">
          <span className="lp__nav-mask">
            <span className="lp__nav-link lp__nav-brand">Eunomia</span>
          </span>
          <span className="lp__nav-end">
            <span className="lp__nav-mask">
              <a className="lp__nav-link" href="/docs/">
                Docs
              </a>
            </span>
            <span className="lp__nav-mask">
              <a
                className="lp__nav-link"
                href="https://github.com/eunomia-finance/eunomia"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            </span>
            {/* Rides in with the nav links rather than sitting there through the whole scene. */}
            <span className="lp__nav-mask lp__nav-mask--chip">
              <span className="lp__nav-chip">
                <Suspense fallback={null}>
                  <WalletChip />
                </Suspense>
              </span>
            </span>
          </span>
        </nav>
      </div>

      <div className="lp__hero-bottom">
        <div className="lp__rule" />
        <h1>
          <Words text="You don't have to hand your agent the keys." mark="the keys" />
        </h1>

        {/* Each supporting block rides up out of its own box, the way `hero-1` closes: the
            reference lifts its header letters and nav links with `yPercent: 110 → 0` on
            `expo.out` rather than fading them in. */}
        <div className="lp__rise-box">
          <p className="lp__lede lp__rise">
            Give it a budget instead. The limits live in the contract — not in the prompt, and
            not in the model's good intentions.
          </p>
        </div>

        <div className="lp__rise-box">
          <div className="lp__actions lp__rise">
            {/* Hidden entirely when WebAuthn is absent: the wallet path still works. */}
            {capability !== "none" && (
              <button className="lp__cta" onClick={() => void startPasskey()} disabled={busy}>
                {busy ? "Creating…" : "Create your treasury with a passkey"}
                <span className="lp__cta-hint">
                  {capability === "platform" ? "Fingerprint, face or PIN" : "Pair with your phone"}
                </span>
              </button>
            )}
            <button className="lp__cta lp__cta--ghost" onClick={onWallet}>
              I have a wallet
            </button>
          </div>
        </div>

        {err && (
          <p className="lp__k" style={{ color: "var(--red)", marginTop: 14 }}>
            {err}
          </p>
        )}

        {/* A real element rather than the counter's border-top, so it can be drawn open.
            This is `hero-1`'s box widening out — the reference grows it to `110vw`. */}
        <i className="lp__counter-rule" aria-hidden="true" />
        <div className="lp__rise-box">
          <div className="lp__counter lp__rise">
            <span>
              <b>{TRACTION.blocked}</b> spend attempts blocked
            </span>
            <span>
              <b>{TRACTION.treasuries}</b> treasuries created
            </span>
            <span>
              <b>{TRACTION.actions}</b> actions on-chain
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
