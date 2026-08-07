import { expect } from "chai";
import { buildInput, N } from "../scripts/prove.js";
import { H, buildTree } from "./helpers.js";

describe("buildInput (parametric prover)", () => {
  it("binds each commitment to Poseidon(amount,payee,salt) and roots the whitelist", async () => {
    const batch = {
      payments: [
        { amount: 50n, payee: 11n },
        { amount: 75n, payee: 22n },
      ],
      whitelist: [11n, 22n, 33n],
      dailyLimit: 1000n,
      perTaskLimit: 300n,
      periodId: 2n,
      periodSpent: 125n, // 50 + 75 — what the treasury recorded for the period
    };
    const input = await buildInput(batch);

    // commitments bind to the real openings (with the CSPRNG salt the builder drew)
    expect(input.commitments[0]).to.equal((await H([50n, 11n, BigInt(input.salt[0])])).toString());
    expect(input.commitments[1]).to.equal((await H([75n, 22n, BigInt(input.salt[1])])).toString());

    // public policy carried through, and the root is a real tree over the whitelist
    expect(input.dailyLimit).to.equal("1000");
    expect(input.perTaskLimit).to.equal("300");
    expect(input.periodId).to.equal("2");
    const tree = await buildTree([11n, 22n, 33n], 8);
    expect(input.whitelistRoot).to.equal(tree.root.toString());

    // padded to the circuit's fixed batch, pad slots carry amount 0
    expect(input.amount).to.have.length(N);
    expect(input.amount[2]).to.equal("0");
    expect(input.salt.every((s) => BigInt(s) >= 1n << 128n)).to.equal(true);
  });

  it("refuses a batch that does not account for the period's on-chain spend", async () => {
    const batch = {
      payments: [{ amount: 50n, payee: 11n }],
      whitelist: [11n, 22n, 33n],
      dailyLimit: 1000n,
      perTaskLimit: 300n,
      periodId: 2n,
      periodSpent: 125n, // the chain saw 125; this batch only accounts for 50
    };
    let err: Error | undefined;
    try {
      await buildInput(batch);
    } catch (e) {
      err = e as Error;
    }
    expect(err?.message).to.match(/does not match the period's on-chain spend/);
  });
});
