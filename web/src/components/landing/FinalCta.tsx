import { useEffect, useState } from "react";
import { connectPasskey } from "../../lib/walletKit";
import { passkeyCapability, type PasskeyCapability } from "../../lib/passkeySupport";
import { errText } from "../../lib/wallet-errors";

/** The page's single dark block. Colour earns its weight by being rare — if every section
 *  were filled, none of them would stand out. */
export default function FinalCta({ onEnter }: { onEnter: () => void }) {
  const [capability, setCapability] = useState<PasskeyCapability>("none");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    void passkeyCapability(window).then(setCapability);
  }, []);

  const start = async () => {
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
    <section className="lp__section">
      <div className="lp__in">
        <div className="lp__final lp__reveal">
          <h2>Your treasury, in 30 seconds.</h2>
          <p className="lp__lede">
            No wallet to install, no seed phrase, no XLM to buy first. Sign in with your
            fingerprint and set the rules yourself.
          </p>
          <div className="lp__actions">
            {capability !== "none" && (
              <button className="lp__cta" onClick={() => void start()} disabled={busy}>
                {busy ? "Creating…" : "Start with a passkey"}
              </button>
            )}
            <a className="lp__cta lp__cta--ghost" href="/docs/">
              Documentation →
            </a>
          </div>
          {err && (
            <p className="lp__k" style={{ color: "#ff8a78", marginTop: 14 }}>
              {err}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
