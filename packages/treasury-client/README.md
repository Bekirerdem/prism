# treasury-client

Generated TypeScript client for the **Eunomia Treasury** contract — produced by
`stellar contract bindings typescript` from the treasury wasm. **Do not edit
`src/index.ts` by hand**; it is generator output.

## Regenerating (after any contract change)

```bash
# from packages/treasury-client — builds bindings from the local wasm and
# syncs the web app's copy in one go:
npm run generate
```

- `generate` renders bindings from `target/wasm32v1-none/release/treasury.wasm`
  (build it first with `stellar contract build`) into a temp dir, copies
  `src/index.ts` here, then runs `sync:web`.
- `sync:web` copies `src/index.ts` → `web/src/lib/treasuryClient.ts` (the web app
  ships its own copy; no npm workspace).
- `check:sync` (`cmp`) is what CI runs — the two copies must stay byte-identical.

## Consuming

The web app imports its synced copy directly (`web/src/lib/treasuryClient.ts`).
To use this package standalone, `npm install && npm run build` and import from
`dist/`. Current ABI: treasury v3.1 — policy gate + escrow + agent sessions +
lifecycle + rolling 24h window (`Errors` 1–12).
