// Decides what renders inside the shell for a given view. Treasury-scoped pages fall
// back to Setup (connect gate / creation wizard) until a treasury is open; Activity and
// the guided Demo work without a wallet. Pages stay lazy so the stellar-sdk chunk only
// downloads when a view needs it.
import { Suspense, lazy } from "react";
import { useTreasury } from "../../state/useTreasury";
import type { View } from "../../lib/routes";

const Dashboard = lazy(() => import("../Dashboard"));
const Wallet = lazy(() => import("../Wallet"));
const ActivityPage = lazy(() => import("../../pages/ActivityPage"));
const Overview = lazy(() => import("../../pages/Overview"));
const Payments = lazy(() => import("../../pages/Payments"));
const Agent = lazy(() => import("../../pages/Agent"));
const Settings = lazy(() => import("../../pages/Settings"));
const Setup = lazy(() => import("../../pages/Setup"));

export default function ShellRouter({ view, onGo }: { view: View; onGo: (v: View) => void }) {
  const t = useTreasury();

  const content = (() => {
    if (view === "dashboard") return <Dashboard onHome={() => onGo("landing")} />;
    if (view === "wallet") return <Wallet />;
    if (view === "activity") return <ActivityPage />;
    // Treasury-scoped pages: overview / payments / agent / settings.
    if (!t.address || !t.treasuryId || t.creatingNew) return <Setup onGo={onGo} />;
    if (view === "payments") return <Payments />;
    if (view === "agent") return <Agent />;
    if (view === "settings") return <Settings />;
    return <Overview onGo={onGo} />;
  })();

  return <Suspense fallback={null}>{content}</Suspense>;
}
