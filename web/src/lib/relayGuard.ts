// The relay endpoint is public in an open-source repo: without this gate anyone could spend
// our OZ Channels fee quota. Kept as a pure function so it is testable without the Node
// runtime the proxy itself runs in.

/** Soroban contract ids are StrKey-encoded, start with `C`, and are 56 characters long. */
const CONTRACT_ID = /^C[A-Z2-7]{55}$/;

/** Whether the relay may forward a call to this contract.
 *  Fails closed: a malformed id, a non-contract StrKey, or a missing allowlist all reject. */
export function isAllowedContract(id: string, allowlist: string[]): boolean {
  if (!CONTRACT_ID.test(id)) return false;
  return allowlist.includes(id);
}
