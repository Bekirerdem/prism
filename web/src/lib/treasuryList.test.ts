import { describe, expect, it } from "vitest";
import { mergeTreasuries } from "./treasuryList";

describe("mergeTreasuries", () => {
  it("marks registry entries registered and local-only ones not", () => {
    expect(mergeTreasuries(["C1", "C3"], ["C1", "C2"])).toEqual([
      { id: "C1", registered: true },
      { id: "C2", registered: true },
      { id: "C3", registered: false },
    ]);
  });

  it("handles empty inputs", () => {
    expect(mergeTreasuries([], [])).toEqual([]);
    expect(mergeTreasuries(["C1"], [])).toEqual([{ id: "C1", registered: false }]);
    expect(mergeTreasuries([], ["C1"])).toEqual([{ id: "C1", registered: true }]);
  });

  it("never duplicates an id present in both", () => {
    const out = mergeTreasuries(["C1"], ["C1"]);
    expect(out).toHaveLength(1);
    expect(out[0].registered).toBe(true);
  });
});
