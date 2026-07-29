/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: { global: 'globalThis' },
  test: {
    // Playwright owns tests/e2e — vitest must not try to collect its specs.
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
})
