import type { CSSProperties } from "react";

// Feedback funnels to ONE channel — the Google Form (name + email + wallet + rating) — so
// every response lands in a single sheet (risein Level 5 evidence) instead of splitting
// between Supabase and the form. The in-app Supabase modal was retired and removed;
// the existing Supabase `feedback` rows are kept as early feedback.
const FEEDBACK_FORM_URL = "https://forms.gle/7gzJWwte52SmbXei7";

// A real anchor, not window.open: browsers block scripted popups even from a click
// handler (Chrome's default "pop-ups and redirects: blocked"), so window.open returned
// null and the button silently did nothing. Anchor navigation is never popup-blocked.
export default function FeedbackButton() {
  return (
    <a style={fab} href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer">
      Share feedback
    </a>
  );
}

const fab: CSSProperties = {
  position: "fixed", right: 18, bottom: 18, zIndex: 1500,
  padding: "11px 17px", borderRadius: 999, cursor: "pointer",
  display: "inline-block", textDecoration: "none", fontFamily: "inherit", lineHeight: 1.4,
  background: "rgba(18,18,28,0.82)", border: "1px solid rgba(253,218,36,0.45)",
  color: "#FDDA24", fontWeight: 600, fontSize: 13.5, backdropFilter: "blur(8px)",
  boxShadow: "0 8px 24px -10px rgba(0,0,0,0.6)",
};
