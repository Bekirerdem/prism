# prover

Off-chain tooling for Eunomia's ZK compliance layer: turns snarkjs Groth16 output
into the byte layout the on-chain BN254 verifier expects, and generates the
commitment salts.

| File | Role |
|---|---|
| `src/encode.ts` | snarkjs proof/public-signals JSON → Soroban raw bytes (proof 256B, publics 384B) |
| `src/salt.ts` | CSPRNG commitment salts (closes the hiding break a predictable salt would open) |
| `src/emit-fixtures.ts` | writes `proof.bin`/`public.bin` test fixtures from `circuits/build/…` output |
| `src/submit.ts` / `src/prove-and-submit.ts` | drive `stellar contract invoke verify(...)` via the CLI |

`npm test` runs the CSPRNG salt tests (3) — self-contained, no network. The
`fixtures`/`submit` scripts need the ZK build artifacts (`circuits/build/`,
gitignored) and the `stellar` CLI with a funded identity (toolchain: circom + snarkjs + Hermez ptau).
