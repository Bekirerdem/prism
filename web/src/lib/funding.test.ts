import { describe, it, expect, vi } from "vitest";
import { fundWithFriendbot, getXlmBalance, needsFunding, MIN_XLM } from "./funding";

const res = (status: number, body?: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe("getXlmBalance", () => {
  it("returns the native balance", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      res(200, {
        balances: [
          { asset_type: "credit_alphanum4", balance: "9.0000000" },
          { asset_type: "native", balance: "123.4567890" },
        ],
      }),
    );
    expect(await getXlmBalance("GABC", fetchFn)).toBeCloseTo(123.456789);
  });

  it("returns null for a not-yet-created account (404)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(res(404));
    expect(await getXlmBalance("GABC", fetchFn)).toBeNull();
  });

  it("throws on other Horizon errors", async () => {
    const fetchFn = vi.fn().mockResolvedValue(res(500));
    await expect(getXlmBalance("GABC", fetchFn)).rejects.toThrow(/500/);
  });
});

describe("fundWithFriendbot", () => {
  it("resolves when friendbot funds the account", async () => {
    const fetchFn = vi.fn().mockResolvedValue(res(200, {}));
    await expect(fundWithFriendbot("GABC", fetchFn)).resolves.toBeUndefined();
  });

  it("explains the already-funded case (400)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(res(400, {}));
    await expect(fundWithFriendbot("GABC", fetchFn)).rejects.toThrow(/already funded/);
  });

  it("sends a smart wallet to the dispenser instead — friendbot cannot fund a contract", async () => {
    // Friendbot creates classic accounts, and a classic payment cannot reach a contract
    // address at all, so a passkey user pressing this button was asking for the impossible.
    const fetchFn = vi.fn().mockResolvedValue(res(200, {}));
    const wallet = "CBBUJFC4JUV3DYJOGFAYYSVLZCYPXZJIPQZARQEGSFAVVG37HP7YPGFU";

    await expect(fundWithFriendbot(wallet, fetchFn)).resolves.toBeUndefined();

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("/api/faucet");
    expect(JSON.parse(init.body)).toEqual({ wallet });
  });

  it("reports a wallet that already drew its allocation (409)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(res(409, { error: "This wallet already has funds." }));
    const wallet = "CBBUJFC4JUV3DYJOGFAYYSVLZCYPXZJIPQZARQEGSFAVVG37HP7YPGFU";

    await expect(fundWithFriendbot(wallet, fetchFn)).rejects.toThrow(/already has its starting/i);
  });

  it("passes the daily-limit refusal through verbatim (429)", async () => {
    // "Try again tomorrow" is actionable; the generic failure text is not.
    const fetchFn = vi
      .fn()
      .mockResolvedValue(res(429, { error: "The testnet faucet has hit its daily limit. Try again tomorrow." }));
    const wallet = "CBBUJFC4JUV3DYJOGFAYYSVLZCYPXZJIPQZARQEGSFAVVG37HP7YPGFU";

    await expect(fundWithFriendbot(wallet, fetchFn)).rejects.toThrow(/daily limit.*tomorrow/i);
  });
});

describe("needsFunding", () => {
  it("flags missing accounts and low balances", () => {
    expect(needsFunding(null)).toBe(true);
    expect(needsFunding(MIN_XLM - 1)).toBe(true);
    expect(needsFunding(MIN_XLM)).toBe(false);
  });
});
