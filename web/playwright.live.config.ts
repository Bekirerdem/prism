// Playwright config for the checks that can only be true against production.
//
// The default config starts a dev server and drives it with an injected signer. A passkey
// cannot be tested that way: the credential is bound to rp.id = eunomia.finance, and the
// relay's credentials are Production-scoped, so localhost proves nothing about the path
// real users take. This config points at the live site and starts no server.
//
//   npx playwright test --config playwright.live.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.live.spec.ts",
  // Each run spends a real faucet allocation and writes to chain; serial keeps that
  // legible and keeps two runs from racing for the same daily quota.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0, // a retry would burn a second allocation and hide a flaky relay
  reporter: [["html", { open: "never" }], ["list"]],
  // Deploy + faucet + treasury creation are three chain round trips behind a relay.
  timeout: 600_000,
  use: {
    baseURL: process.env.LIVE_BASE_URL ?? "https://eunomia.finance",
    // No secrets are injected on this path — the passkey is virtual and lives only in the
    // browser — so a trace carries nothing sensitive and is worth having when it fails.
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
