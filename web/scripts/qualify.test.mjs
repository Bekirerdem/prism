import { describe, it, expect } from "vitest";
import { applyFunding } from "./qualify.mjs";

const owners = () => ({
  GA: { treasuries: ["CA1"], firstSeen: "2026-07-01T00:00:00Z" },
  GB: { treasuries: ["CB1"], firstSeen: "2026-07-02T00:00:00Z" },
});

describe("applyFunding", () => {
  it("counts an owner whose treasury holds value as active", () => {
    const o = owners();
    const { active, pending } = applyFunding(o, new Set(["GA"]));
    expect(active).toBe(1);
    expect(pending).toBe(1);
    expect(o.GA.funded).toBe(true);
    expect(o.GB.funded).toBeUndefined();
  });

  it("keeps an owner active after they withdraw everything", () => {
    // Balance is a "right now" reading; being a user is not. Without this an owner who
    // emptied their treasury would silently drop out of the evidence.
    const o = owners();
    applyFunding(o, new Set(["GA"]));
    const { active } = applyFunding(o, new Set()); // nothing holds value on this run
    expect(active).toBe(1);
    expect(o.GA.funded).toBe(true);
  });

  it("leaves a never-funded registration pending", () => {
    // A treasury that only ever got deployed is the shape mass-registration would take:
    // our relay sponsors deploy fees, so registering costs an attacker nothing.
    const o = owners();
    const { active, pending } = applyFunding(o, new Set());
    expect(active).toBe(0);
    expect(pending).toBe(2);
  });
});
