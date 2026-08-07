// The sign-up a stranger actually does, driven end to end: passkey → starting XLM →
// treasury. Nothing here is injected or stubbed — it is the live site, the live relay and
// the live chain.
//
// Why this exists: on 2026-08-07 treasury creation had been broken for two days for every
// passkey user (the relay stopped admitting the wasm the app deploys) and nothing noticed,
// because this path had no automated coverage at all. The wallet smoke could not see it —
// it signs with an injected key and never reaches the relay.
//
// Why it runs against production rather than a dev server: a passkey is bound to its
// WebAuthn rp.id, which is eunomia.finance. On localhost or a preview domain the browser
// refuses the credential outright, and the relay's own credentials are Production-scoped,
// so a local run would prove nothing about the thing that broke.
//
//   npx playwright test --config playwright.live.config.ts
//
// Costs one faucet allocation per run (capped per wallet and per day), so this is a
// deliberate check — before a release, or when the relay/treasury wasm changes — not a
// per-commit gate. The wallets it creates are throwaways; see the note in
// docs/metrics/e2e-exclude.json about keeping them out of the user evidence.
//
// KNOWN RED (2026-08-07): the treasury is created and registered, but the workspace then
// says "Could not read this treasury" and reports the wallet at 0.00 XLM despite the
// faucet having just funded it. Both reads concern a contract address, so the two are
// probably one defect. The assertion stays strict: this is what a new user sees.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect, type CDPSession, type Page } from "@playwright/test";

const EXCLUDE = fileURLToPath(new URL("../../../docs/metrics/e2e-exclude.json", import.meta.url));

/** Keep this run's throwaway wallet out of the user evidence.
 *
 *  A live run registers its treasury exactly as a real visitor would, so without this
 *  every check would quietly add a "user" to the numbers we publish — the same way our
 *  own 08-04 test wallets did before they were caught. Recording it here, from the test
 *  that created it, is the only version of this that does not depend on someone
 *  remembering. */
function excludeFromUserCount(wallet: string): void {
  const file = JSON.parse(readFileSync(EXCLUDE, "utf8")) as { note: string; wallets: string[] };
  if (file.wallets.includes(wallet)) return;
  file.wallets.push(wallet);
  writeFileSync(EXCLUDE, JSON.stringify(file, null, 2) + "\n");
}

/** Turn on Chrome's built-in virtual authenticator: a passkey the test can create and use
 *  with no sensor and no human. `isUserVerified` + `automaticPresenceSimulation` make the
 *  browser answer the verification prompt itself, which is what lets an unattended run
 *  complete a ceremony that normally needs a fingerprint. */
async function enableVirtualPasskey(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return cdp;
}

test.describe.serial("Live passkey onboarding", () => {
  test("a new visitor can create a passkey, get testnet XLM and open a treasury", async ({
    page,
  }) => {
    test.info().annotations.push({
      type: "network",
      description: "Drives eunomia.finance, the relay and Stellar testnet for real",
    });

    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    // The app deliberately keeps its user-facing messages short and puts the reason in the
    // console (the relay prints the status it was refused with). Without this the run
    // reports "something failed" and the next person goes archaeology-hunting on chain.
    const consoleErrors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    // A bare "403" in the console names neither the endpoint nor the call. Record the URL
    // and status of anything that fails, so a red run says which seam broke.
    const badResponses: string[] = [];
    page.on("response", (r) => {
      if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
    });

    await enableVirtualPasskey(page);
    await page.goto("/");

    // 1. Sign up with a passkey. No wallet, no seed phrase.
    await page.getByRole("button", { name: /start with a passkey/i }).first().click();

    // 2. The recovery code is shown once and the step is mandatory — acknowledging it is
    //    what puts the wallet-restricted signer on chain, so a failure here is real.
    const saved = page.getByRole("button", { name: /i saved it/i });
    await saved.waitFor({ state: "visible", timeout: 120_000 });
    await saved.click();

    // 3. Land in the workspace as a funded-from-zero user.
    await expect(page).toHaveURL(/#(overview|setup)/, { timeout: 120_000 });

    // 4. Take the starting XLM. The dispenser is the only way value reaches a smart
    //    wallet — friendbot cannot fund a contract address.
    const faucet = page.getByRole("button", { name: /get free testnet xlm/i }).first();
    await faucet.waitFor({ state: "visible", timeout: 60_000 });
    await faucet.click();
    // Match the toast's words, not just its kind. Toasts linger for seconds, so a bare
    // "a success toast exists" would let the NEXT step pass on this one and report a
    // treasury that was never created.
    await expect(page.locator('[data-toast-kind="success"]', { hasText: /funded/i })).toBeVisible({
      timeout: 120_000,
    });

    // 5. Create the treasury — the step that was silently failing with a relay 403.
    await page.getByLabel(/daily limit.*xlm/i).first().fill("50");
    await page.getByLabel(/per-payment limit.*xlm/i).first().fill("10");
    await page.getByRole("button", { name: /create treasury/i }).first().click();

    // Named explicitly, so this cannot pass on the faucet's toast still being on screen.
    await expect(
      page.locator('[data-toast-kind="success"]', { hasText: /treasury created/i }),
    ).toBeVisible({ timeout: 180_000 });
    // Carry the toast's words into the failure, not just a count — "expected 0, got 1"
    // sends the next person hunting through screenshots for what actually broke.
    const errors = await page.locator('[data-toast-kind="error"]').allTextContents();
    expect(
      errors,
      `onboarding raised an error toast: ${errors.join(" | ")}` +
        `\nfailed requests: ${badResponses.join(" | ")}` +
        `\nconsole: ${consoleErrors.join(" | ")}`,
    ).toEqual([]);

    // The real proof: the app wrote a treasury id against this wallet, which only happens
    // once the deploy came back with a contract id — i.e. the relay sponsored it and the
    // chain accepted the policy. This is the assertion the 08-07 relay outage would fail.
    const created = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.startsWith("prism_treasuries:"));
      if (!key) return null;
      const rec = JSON.parse(localStorage.getItem(key)!) as { ids: string[] };
      return { wallet: key.slice("prism_treasuries:".length), treasury: rec.ids.at(-1) };
    });
    expect(created, "no treasury was recorded for this wallet").not.toBeNull();
    expect(created!.treasury).toMatch(/^C[A-Z2-7]{55}$/);

    expect(pageErrors).toEqual([]);

    // Keep this run's throwaway wallet out of the published user numbers.
    excludeFromUserCount(created!.wallet);
    test.info().annotations.push({
      type: "created",
      description: `wallet ${created!.wallet} → treasury ${created!.treasury} (excluded from user count)`,
    });
  });
});
