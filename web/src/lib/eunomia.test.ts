import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  pay: vi.fn(),
}));

vi.mock("./treasuryClient", () => ({
  // A real class so `new Client(...)` works — arrow-fn mocks aren't constructable.
  Client: class {
    pay = mocks.pay;
    balance = vi.fn();
    get_config = vi.fn();
    day_spent = vi.fn();
    task_spent = vi.fn();
  },
}));

import { agentPay, isTransient } from "./eunomia";

const okTx = (hash: string) => ({
  signAndSend: async () => ({ sendTransactionResponse: { hash } }),
});

describe("isTransient", () => {
  it("matches stale-sequence and busy-infra errors", () => {
    expect(isTransient("transaction submission failed: tx_bad_seq")).toBe(true);
    expect(isTransient("HTTP 429 Too Many Requests")).toBe(true);
    expect(isTransient("fetch failed")).toBe(true);
  });

  it("matches the RPC's TRY_AGAIN_LATER status", () => {
    expect(isTransient("sendTransaction status: TRY_AGAIN_LATER")).toBe(true);
  });

  it("does not match permanent failures", () => {
    expect(isTransient("Bad union switch: 4")).toBe(false);
    expect(isTransient("invalid destination address")).toBe(false);
  });
});

describe("agentPay", () => {
  beforeEach(() => mocks.pay.mockReset());

  it("returns success with the tx hash", async () => {
    mocks.pay.mockResolvedValueOnce(okTx("abc123"));
    const res = await agentPay(1n, "GDEST", 10n);
    expect(res).toEqual({ ok: true, hash: "abc123" });
  });

  it("short-circuits on a contract guardrail rejection — never retried", async () => {
    mocks.pay.mockRejectedValueOnce(new Error("host error: Error(Contract, #2)"));
    const res = await agentPay(1n, "GDEST", 10n);
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe(2);
    expect(res.transient).toBeUndefined();
    expect(mocks.pay).toHaveBeenCalledTimes(1);
  });

  it("retries a stale sequence and succeeds on the next attempt", async () => {
    mocks.pay
      .mockRejectedValueOnce(new Error("transaction submission failed: tx_bad_seq"))
      .mockResolvedValueOnce(okTx("retry-ok"));
    const res = await agentPay(2n, "GDEST", 10n);
    expect(res).toEqual({ ok: true, hash: "retry-ok" });
    expect(mocks.pay).toHaveBeenCalledTimes(2);
  });

  it("does NOT label a permanent failure as transient (no retry invitation)", async () => {
    mocks.pay.mockRejectedValueOnce(new Error("Bad union switch: 4"));
    const res = await agentPay(3n, "GDEST", 10n);
    expect(res.ok).toBe(false);
    expect(res.transient).toBeUndefined();
    expect(res.errorMessage).toMatch(/Bad union switch/);
    expect(mocks.pay).toHaveBeenCalledTimes(1); // permanent → no retries
  });
}, 20_000);
