import { describe, it, expect } from "vitest";
import { buildFunnelRow, detectDevice } from "./funnel";

describe("buildFunnelRow", () => {
  it("maps a full input to the funnel_events row shape", () => {
    expect(
      buildFunnelRow({
        event: "connect_result",
        device: "mobile",
        walletId: "freighter",
        outcome: "error",
        detail: "user rejected",
        sessionId: "sess-123",
      }),
    ).toEqual({
      event: "connect_result",
      device: "mobile",
      wallet_id: "freighter",
      outcome: "error",
      detail: "user rejected",
      session_id: "sess-123",
    });
  });

  it("nulls optional fields when absent", () => {
    expect(buildFunnelRow({ event: "page_view" })).toEqual({
      event: "page_view",
      device: null,
      wallet_id: null,
      outcome: null,
      detail: null,
      session_id: null,
    });
  });

  it("clamps overlong values to the column limits", () => {
    const row = buildFunnelRow({
      event: "connect_result",
      walletId: "w".repeat(60),
      detail: "d".repeat(300),
      sessionId: "s".repeat(90),
    });
    expect(row.wallet_id?.length).toBe(40);
    expect(row.detail?.length).toBe(200);
    expect(row.session_id?.length).toBe(64);
  });
});

describe("detectDevice", () => {
  it("classifies narrow viewports as mobile", () => {
    expect(detectDevice(390)).toBe("mobile");
    expect(detectDevice(767)).toBe("mobile");
  });

  it("classifies wide viewports as desktop", () => {
    expect(detectDevice(768)).toBe("desktop");
    expect(detectDevice(1280)).toBe("desktop");
  });
});
