// The treasury WASM the app instantiates for every new user treasury.
//
// Deliberately dependency-free: both the browser bundle and the serverless relay import it,
// and the relay runs outside Vite, where anything reaching `import.meta.env` breaks.
//
// v3.5 (2026-08-07): refuses a daily limit above MAX_BATCH x per-payment limit. Above it
// the agent could spend a day the compliance circuit has no room to attest to, and since
// the verifier only asks periods to move forward, that day would drop out of the record
// silently. Carries v3.4's read-only surfaces (`period_spent`, `whitelist_root`) forward.
//
// Older treasuries keep running the code they were born with; contracts are immutable by
// design, so a treasury created with a policy past the ceiling stays that way.
export const TREASURY_WASM_HASH =
  "824472060b3abec7c6c64e8985fa5d0c5a39ea277fbb67eab3125a483d059641";
