import { useEffect, useState } from "react";
import { connectPasskey } from "../../lib/walletKit";
import { passkeyCapability, type PasskeyCapability } from "../../lib/passkeySupport";
import { errText } from "../../lib/wallet-errors";
import { TRACTION } from "./traction";
import Words from "./Words";

/** The opening screen: one line of pain, the primary passkey door, and proof.
 *
 *  No product screenshot by design — a dashboard image in the hero reads as a tool demo,
 *  not as a company. The counter carries the evidence instead. */
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
      <div className="lp__in">
        <div className="lp__rule" />
        <h1>
          <Words text="You don't have to hand your agent the keys." mark="the keys" />
        </h1>
        <p className="lp__lede">
          Give it a budget instead. The limits live in the contract — not in the prompt, and
          not in the model's good intentions.
        </p>

        <div className="lp__actions">
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

        {err && (
          <p className="lp__k" style={{ color: "var(--red)", marginTop: 14 }}>
            {err}
          </p>
        )}

        <div className="lp__counter">
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
    </section>
  );
}
