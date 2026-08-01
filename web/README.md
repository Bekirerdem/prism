# PRISM Web

The web app for [PRISM](../README.md): cinematic landing, the autonomous-agent demo
dashboard, and the per-user workspace (connect a wallet → deploy your own bounded
treasury). Vite · React 19 · TypeScript · framer-motion · `@stellar/stellar-sdk` +
StellarWalletsKit.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
```

## Test · build · lint

```bash
npm test           # Vitest — pure-lib suites (wallet errors, events, funding, treasury ops…)
npm run build      # tsc -b && vite build
npm run lint       # eslint (known legacy debt in generated treasuryClient.ts)
```

## E2E · Playwright smoke

Browser-level tests against the **real Stellar testnet**. One spec drives the actual
UI through the connect → deploy → fund → whitelist → pay happy path using an
injected test signer (no wallet extension automation).

### One-time setup

1. Install Playwright's browser binary + system deps for Chromium:
   ```bash
   npm run test:e2e:install
   ```

2. Generate a throwaway testnet key and fund it. The test signs with this key —
   it must hold ≥ ~25 test XLM (deploy + fund + fee headroom). Either:
   - Use the Stellar Laboratory's "Create Account" + Friendbot, or
   - Generate a key with the Node REPL:
     ```node
     const { Keypair } = require("@stellar/stellar-sdk");
     const k = Keypair.random();
     console.log("Secret:", k.secret());
     console.log("Public:", k.publicKey());
     // → then curl https://friendbot.stellar.org/?addr=<public> twice
     ```

3. Export the secret as an env var — **never commit it to the repo**:
   ```bash
   export PLAYWRIGHT_TEST_WALLET_SECRET="S…"
   ```
   (Windows PowerShell: `$env:PLAYWRIGHT_TEST_WALLET_SECRET = "S…"`)

### Run the smoke spec

```bash
npm run test:e2e     # => npx playwright test (chromium, starts vite dev server automatically)
```

What the spec does:
1. **Landing** loads with zero `console.error` / uncaught page errors.
2. **Workspace** (`#overview`) opens — the Setup page renders the connect gate.
3. **Connect** — the test-signer injection bypasses the StellarWalletsKit modal.
   The chip shows the injected `G…` address.
4. **Friendbot** — auto-requests test XLM when the wallet has none (best-effort).
5. **Deploy** — creates a fresh treasury with 50 XLM daily / 10 XLM per-task limits.
6. **Fund** — 20 XLM SAC transfer from the wallet into the new treasury.
7. **Whitelist** — adds the sample `SERVICE` payee (on-chain `add_payee`).
8. **Pay** — sends 1 XLM to the whitelisted payee within limits.
9. **State** — balance ≤ 19 XLM; no uncaught page errors.

On failure, the run writes an HTML report + trace to `playwright-report/`; open it with:
```bash
npx playwright show-report
```

### How the test signer is gated

The injection path lives in `src/lib/testSigner.ts`. It compiles in **only** when
`VITE_ENABLE_TEST_SIGNER=true` (a compile-time `import.meta.env` flag — the dead
branch gets tree-shaken out of production builds). At runtime it additionally
requires the `window.__PRISM_TEST_SIGNER__` global that Playwright injects via
`addInitScript` — even if the flag accidentally ships, the code is a no-op
without the global.

```
walletKit.ts
  ├─ connect()           ── test-signer global present? → return the injected address, skip modal
  └─ walletSignerFor()   ── matches the injected address? → sign directly with Keypair
```

### GitHub Actions (manual)

`.github/workflows/e2e-playwright.yml` defines a **`workflow_dispatch`**-only job
— testnet RPC flakiness means it does NOT gate every PR. Run it from the repo's
**Actions → E2E — Playwright smoke (testnet) → Run workflow**.

Requirements in the repo settings:
- A **repository secret** named `PLAYWRIGHT_TEST_WALLET_SECRET` with the funded testnet key.
- (Optional) An **environment** named `testnet-e2e` with reviewers, so humans
  approve each run against the shared key to avoid draining it.

The workflow:
1. Installs deps + `npx playwright install --with-deps chromium`
2. Runs the smoke spec with the secret exposed as `PLAYWRIGHT_TEST_WALLET_SECRET`
3. Uploads `playwright-report/` + `test-results/` as a 14-day retention artifact
   (screenshots, videos, traces — only populated on failure).

## Environment

Optional — the app runs without them, but feedback + activity logging silently no-op:

```
VITE_SUPABASE_URL=…
VITE_SUPABASE_ANON_KEY=…   # publishable key; RLS is insert-only (see ../supabase/migrations)
```

Copy `.env.example` to `.env`. Beware invisible non-ASCII bytes when pasting keys —
`src/lib/supabase.ts` strips them for a reason.

## Deploy

Vercel, manual (no auto-deploy on push):

```bash
vercel --prod      # aliases eunomia.finance
```

Env vars must be set in the Vercel dashboard for Production.

## Layout

```
src/components/   Landing · Dashboard (demo) · Workspace (per-user) · Wallet · ActivityFeed · AppNav/WalletChip
src/lib/          userTreasury (deploy/fund/pay) · walletKit/walletSigner · funding (friendbot)
                  events/analytics (on-chain reads) · feedback/activity (Supabase) · wallet-errors
src/config.ts     testnet contract ids + demo config (build-time non-testnet guard)
```
