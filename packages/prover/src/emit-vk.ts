// groth16_vkey.json -> the verifier contract's VK constant block.
//
// The key changes whenever the circuit's shape changes, and it is ~1KB of hex that
// cannot be hand-written or hand-checked. This regenerates it from the same encoder the
// proof bytes go through (encode.ts), so the two can never drift apart.
//
//   npx tsx src/emit-vk.ts            # prints the Rust block to stdout
//
// Paste the output over the AUTO-GENERATED block in
// contracts/compliance_verifier/src/lib.rs.
import { readFileSync } from "node:fs";
import { hex32 } from "./encode.js";

const VKEY = "../../circuits/build/compliance/groth16_vkey.json";

/** hex string -> `[0x2d, 0x4d, ...]`, wrapped the way rustfmt leaves it. */
function rustBytes(hex: string): string {
  const bytes = hex.match(/../g) ?? [];
  return `[${bytes.map((b) => `0x${b}`).join(", ")}]`;
}

/** G1 point (64B): x || y. */
function g1(p: string[]): string {
  return rustBytes(hex32(p[0]) + hex32(p[1]));
}

/** G2 point (128B): X.c1 || X.c0 || Y.c1 || Y.c0 — the EIP-197 swap vs snarkjs [c0,c1]. */
function g2(p: string[][]): string {
  return rustBytes(hex32(p[0][1]) + hex32(p[0][0]) + hex32(p[1][1]) + hex32(p[1][0]));
}

const vk = JSON.parse(readFileSync(VKEY, "utf8"));

if (vk.protocol !== "groth16" || vk.curve !== "bn128") {
  throw new Error(`unexpected key: ${vk.protocol}/${vk.curve} (want groth16/bn128)`);
}
if (vk.IC.length !== vk.nPublic + 1) {
  throw new Error(`IC has ${vk.IC.length} points but nPublic is ${vk.nPublic}`);
}

const ic = vk.IC.map((p: string[]) => `    ${g1(p)},`).join("\n");

console.log(`// AUTO-GENERATED VK BYTES (uncompressed). DO NOT EDIT.
// Regenerate with: cd packages/prover && npx tsx src/emit-vk.ts
const VK_ALPHA: [u8; BN254_G1_SERIALIZED_SIZE] = ${g1(vk.vk_alpha_1)};
const VK_BETA: [u8; BN254_G2_SERIALIZED_SIZE] = ${g2(vk.vk_beta_2)};
const VK_GAMMA: [u8; BN254_G2_SERIALIZED_SIZE] = ${g2(vk.vk_gamma_2)};
const VK_DELTA: [u8; BN254_G2_SERIALIZED_SIZE] = ${g2(vk.vk_delta_2)};

const VK_IC: [[u8; BN254_G1_SERIALIZED_SIZE]; ${vk.IC.length}] = [
${ic}
];`);

console.error(`emitted VK for ${vk.nPublic} public signals (${vk.IC.length} IC points)`);
