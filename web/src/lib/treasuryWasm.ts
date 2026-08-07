// The treasury WASM the app instantiates for every new user treasury.
//
// Deliberately dependency-free: both the browser bundle and the serverless relay import it,
// and the relay runs outside Vite, where anything reaching `import.meta.env` breaks.
//
// v3.4 (2026-08-06): adds the two read-only surfaces a compliance proof binds to —
// `period_spent(period_id)` and the owner-published `whitelist_root`. Older treasuries keep
// running the code they were born with; contracts here are immutable by design.
export const TREASURY_WASM_HASH =
  "b813a1e7a3d2ddb1013dbaa11a41dcc1fbed984a30cfef9023dc199b12131a72";
