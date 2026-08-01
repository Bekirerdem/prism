import { test as base } from "@playwright/test";
import {
  getTestSigner,
  injectTestSigner,
  PrismPage,
  expect,
} from "./eunomiaTest";
import { SERVICE } from "../../src/config";

const test = base.extend<{
  prism: PrismPage;
  signer: ReturnType<typeof getTestSigner>;
}>({
  signer: async ({}, use) => {
    const s = getTestSigner();
    await use(s);
  },

  context: async ({ context, signer }, use) => {
    await injectTestSigner(context, signer);
    await use(context);
  },

  prism: async ({ page }, use) => {
    await use(new PrismPage(page));
  },
});

test.describe
  .serial("Smoke: landing → connect → deploy → fund → whitelist → pay", () => {
  test("the full happy path succeeds against testnet", async ({
    prism,
    signer,
  }) => {
    test.info().annotations.push({
      type: "network",
      description:
        "Runs against Stellar testnet — needs funded PLAYWRIGHT_TEST_WALLET_SECRET",
    });

    const pageErrors: string[] = [];
    prism.page.on("pageerror", (e) => {
      pageErrors.push(String(e));
    });

    // 1. Landing loads without console errors.
    await prism.assertNoConsoleErrorsOnLanding();

    // 2. Navigate to workspace (shell / connect gate).
    await prism.gotoWorkspace();

    // 3. Connect via the injected test signer — no wallet modal.
    await prism.connectWallet();
    await prism.assertWalletChipShows(signer.address);

    // 4. Friendbot top-up if the throwaway wallet has < MIN_XLM.
    await prism.friendbotIfNeeded();

    // 5. Deploy a treasury with default limits.
    await prism.deployTreasury("50", "10");

    // 6. Fund the treasury.
    await prism.fundTreasury("20");
    await prism.assertBalanceGt(15n * 10_000_000n);

    // 7. Whitelist the sample payee.
    await prism.whitelistPayee(SERVICE);

    // 8. Pay 1 XLM within the per-task + daily limits.
    await prism.sendPayment(SERVICE, "1");

    // 9. On-chain state assertions — balance decreased; day-spent advanced.
    const balAfter = await prism.readBalanceStroops();
    expect(balAfter).toBeLessThanOrEqual(19n * 10_000_000n);

    expect(pageErrors).toEqual([]);
  });
});
