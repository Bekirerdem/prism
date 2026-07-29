import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: { global: 'globalThis' },
  test: {
    // Playwright owns tests/e2e — vitest must not try to collect its specs.
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    server: {
      deps: {
        // The kit ships ESM but is externalized by default; inlining routes it through
        // vite's resolver so the freighter-api alias below actually applies.
        inline: [/@creit\.tech\/stellar-wallets-kit/],
      },
    },
    alias: {
      // CJS package whose named exports break node-ESM interop under vitest; the kit's
      // Freighter module imports it, and walletDevice.test.ts imports that module for
      // the real FREIGHTER_ID. See src/test-stubs/freighter-api.ts.
      '@stellar/freighter-api': fileURLToPath(
        new URL('./src/test-stubs/freighter-api.ts', import.meta.url),
      ),
    },
  },
})
