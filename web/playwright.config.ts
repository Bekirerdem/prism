import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  // The smoke spec drives 4-5 real testnet transactions back to back; 180s left no
  // headroom once a single RPC round slowed down.
  timeout: 300_000,
  use: {
    baseURL: "http://localhost:5173",
    // Traces and videos are for local debugging only, and that is a security
    // boundary rather than a preference. A trace records addInitScript's source AND
    // its arguments verbatim, and injectTestSigner passes the funded testnet wallet
    // secret as an argument. On CI the run uploads test-results/ as an artifact from
    // a PUBLIC repository, so a single failing test would have published a live
    // signing key with a 14-day download window. Screenshots carry no such payload
    // and stay on everywhere, which keeps failures diagnosable in CI.
    trace: process.env.CI ? "off" : "retain-on-failure",
    video: process.env.CI ? "off" : "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_ENABLE_TEST_SIGNER: "true",
    },
  },
});
