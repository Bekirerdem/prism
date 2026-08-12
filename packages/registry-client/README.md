# registry-client

Generated TypeScript client for the **Eunomia Treasury Registry** contract (the
permissionless wallet → treasury discovery index used for cross-device recovery).
Produced by `stellar contract bindings typescript`; **do not edit `src/index.ts`
by hand**.

## Regenerating

```bash
# from packages/registry-client — regenerates from the local wasm
# (stellar contract build first) and syncs the web copy:
npm run generate
```

`sync:web` copies `src/index.ts` → `web/src/lib/registryClient.ts`; CI keeps the
two byte-identical via `check:sync` (`cmp`). ABI: `register(owner, treasury)`
(owner-signed, deduped) and `treasuries_of(owner) → Address[]`.
