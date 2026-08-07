import { expect } from "chai";
import { readFileSync } from "node:fs";
import { N } from "../scripts/prove.js";

// The circuit's batch size is written down in three places that cannot see each other:
// the circuit is compiled from circuits.json, the prover pads to its own N, and the
// treasury refuses any daily limit those N slots could not add up to. If they drift, the
// failure is silent in the worst way — a period the treasury happily allows becomes one
// no proof can cover, and the verifier only asks periods to move forward, so the day
// disappears from the attestation record without a trace.
describe("batch size agrees everywhere", () => {
  it("matches the parameter the circuit is compiled with", () => {
    const circuits = JSON.parse(readFileSync(new URL("../circuits.json", import.meta.url), "utf8"));
    expect(circuits.compliance.params[0]).to.equal(N);
  });

  it("matches the treasury's MAX_BATCH, which is what enforces it on-chain", () => {
    const lib = readFileSync(new URL("../../contracts/treasury/src/lib.rs", import.meta.url), "utf8");
    const declared = lib.match(/pub const MAX_BATCH: i128 = (\d+);/);
    expect(declared, "treasury no longer declares MAX_BATCH").to.not.equal(null);
    expect(Number(declared![1])).to.equal(N);
  });

  it("matches the public-signal count the verifier expects (5 header signals + N)", () => {
    const lib = readFileSync(
      new URL("../../contracts/compliance_verifier/src/lib.rs", import.meta.url),
      "utf8",
    );
    const signals = lib.match(/const SIGNALS: u32 = (\d+);/);
    expect(signals, "verifier no longer declares SIGNALS").to.not.equal(null);
    expect(Number(signals![1])).to.equal(5 + N);
  });
});
