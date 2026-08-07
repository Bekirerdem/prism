// The relay endpoint is public in an open-source repo: without this gate anyone could spend
// our OZ Channels fee quota. Kept as a pure function so it is testable without the Node
// runtime the proxy itself runs in.
import { TREASURY_WASM_HASH } from "./treasuryWasm";

/** Soroban contract ids are StrKey-encoded, start with `C`, and are 56 characters long. */
const CONTRACT_ID = /^C[A-Z2-7]{55}$/;

/** Wasm hashes the relay will sponsor a deploy of: whatever the environment names, plus the
 *  treasury wasm this build actually deploys.
 *
 *  That last part is not configuration, for the same reason the native SAC is hardcoded in
 *  the contract allowlist: a passkey user cannot create a treasury at all unless the relay
 *  admits the code the app is shipping. Leaving it to an env var meant the two drifted the
 *  moment the treasury was upgraded, and every passkey sign-up was refused with 403 until
 *  someone noticed. The env stays useful for keeping OLDER hashes reachable. */
export function allowedWasmHashes(envValue: string | undefined): string[] {
  const listed = (envValue ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return listed.includes(TREASURY_WASM_HASH) ? listed : [...listed, TREASURY_WASM_HASH];
}

/** Whether the relay may forward a call to this contract.
 *  Fails closed: a malformed id, a non-contract StrKey, or a missing allowlist all reject. */
export function isAllowedContract(id: string, allowlist: string[]): boolean {
  if (!CONTRACT_ID.test(id)) return false;
  return allowlist.includes(id);
}

export interface RelayGuardConfig {
  /** Contracts admitted by address — ours and fixed, e.g. the treasury registry. */
  contracts: string[];
  /** Wasm hashes admitted by code — covers the per-user treasuries we cannot enumerate. */
  wasmHashes: string[];
  /** Reads the wasm hash a deployed contract runs; null when the contract isn't on chain. */
  readWasmHash: (contractId: string) => Promise<string | null>;
}

/** The relay's admission decision.
 *
 *  A fixed address list alone cannot work here: treasuries are deployed per user, so their
 *  ids are unknown up front. What every genuine treasury shares is the wasm it runs, so an
 *  unlisted contract is admitted only when its code is ours.
 *
 *  Fails closed throughout — malformed ids, missing contracts and RPC outages all reject,
 *  because the alternative is an open relay paying fees for anyone. */
export async function isRelayAllowed(
  contractId: string,
  cfg: RelayGuardConfig,
): Promise<boolean> {
  if (!CONTRACT_ID.test(contractId)) return false;
  if (cfg.contracts.includes(contractId)) return true;

  let hash: string | null;
  try {
    hash = await cfg.readWasmHash(contractId);
  } catch {
    return false;
  }
  if (!hash) return false;

  const seen = hash.toLowerCase();
  return cfg.wasmHashes.some((h) => h.toLowerCase() === seen);
}
