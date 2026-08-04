import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { join } from "node:path";

// XDR values are checked with `instanceof`, so two copies of the SDK are two incompatible
// sets of classes. An auth entry built here and handed to passkey-kit failed inside the kit's
// own writer with "XDR Write Error: <nonce> is not a Te" — a live failure whose cause was
// nowhere near where it surfaced.
//
// passkey-kit declares the SDK as a peer (>=16.0.0) but also pins it exactly as a direct
// dependency, so npm will happily install a second copy again on any lockfile refresh. The
// `overrides` entry in package.json prevents that; this test is what notices if it stops
// working.
describe("stellar-sdk resolution", () => {
  it("resolves to one copy for the app and for passkey-kit", () => {
    const root = process.cwd();
    const ours = createRequire(join(root, "package.json")).resolve("@stellar/stellar-sdk");
    const theirs = createRequire(
      join(root, "node_modules/passkey-kit/dist/kit.js"),
    ).resolve("@stellar/stellar-sdk");

    expect(theirs).toBe(ours);
  });
});
