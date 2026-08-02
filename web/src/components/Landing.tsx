// Landing — the marketing surface.
//
// Rewritten from the technical page that preceded it. That version opened with "muxed
// sub-addresses", "Groth16/BN254" and "ERC-8004"; none of those words appear here any more.
// They were not deleted, they moved to /docs — this page carries what they achieve.
//
// Design tokens and the contrast measurements behind them: web/docs/design/palette-preview.html
// Spec: docs/superpowers/specs/2026-08-02-landing-redesign-design.md
import { Suspense, lazy } from "react";
import "./landing.css";
import { useReveal } from "./landing/useReveal";
import Hero from "./landing/Hero";
import Proof from "./landing/Proof";
import HowItWorks from "./landing/HowItWorks";
import Guarantees from "./landing/Guarantees";
import Privacy from "./landing/Privacy";
import FinalCta from "./landing/FinalCta";
import Footer from "./landing/Footer";

// The wallet chip pulls in the wallet kit — lazy so the landing bundle stays light.
const WalletChip = lazy(() => import("./WalletChip"));

export default function Landing({
  onEnter,
  onWallet,
}: {
  /** After a passkey session exists, go straight to the workspace. */
  onEnter: () => void;
  /** The "I have a wallet" path — opens the existing wallet modal flow. */
  onWallet: () => void;
}) {
  useReveal();

  return (
    // `lp--pending` hides the reveal targets from the first paint; useReveal either animates
    // them in or removes the class outright. See landing.css for why it is not a media query.
    <div className="lp lp--pending">
      <div style={{ position: "absolute", top: 18, right: 22, zIndex: 2 }}>
        <Suspense fallback={null}>
          <WalletChip />
        </Suspense>
      </div>

      <Hero onEnter={onEnter} onWallet={onWallet} />
      <Proof />
      <HowItWorks />
      <Guarantees />
      <Privacy />
      <FinalCta onEnter={onEnter} />
      <Footer />
    </div>
  );
}
