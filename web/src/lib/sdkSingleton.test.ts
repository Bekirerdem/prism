import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { join } from "node:path";
import config from "../../vite.config";

// XDR encoding checks values with `instanceof`, so two copies of @stellar/stellar-sdk in one
// bundle are two incompatible sets of classes. An auth entry built by the app's SDK was
// rejected inside passkey-kit's own writer — "XDR Write Error: <nonce> is not a Te" — the
// first time a real passkey signed a deploy. Nothing about it is visible at the call site.
//
// The npm tree genuinely holds several copies and is left that way on purpose: collapsing it
// with `overrides` re-resolved transitive dependencies and left the SDK's CommonJS entry
// requiring an ESM-only @noble/hashes, which killed the relay function on boot. So the fix
// lives in the bundler, and this is what notices if it is removed.
describe("stellar-sdk bundling", () => {
  it("dedupes the SDK, because the tree really does carry more than one copy", () => {
    expect(config.resolve?.dedupe).toContain("@stellar/stellar-sdk");

    const root = process.cwd();
    const ours = createRequire(join(root, "package.json")).resolve("@stellar/stellar-sdk");
    const theirs = createRequire(
      join(root, "node_modules/passkey-kit/dist/kit.js"),
    ).resolve("@stellar/stellar-sdk");

    // If this ever stops being true the dedupe is no longer load-bearing — but until then it
    // is the only thing keeping one set of XDR classes in the bundle.
    expect(theirs).not.toBe(ours);
  });
});
