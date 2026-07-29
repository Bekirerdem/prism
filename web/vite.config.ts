/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: { global: 'globalThis' },
  test: {
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
