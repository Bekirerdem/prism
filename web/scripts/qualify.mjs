// Which registrations count as users — the rule behind the numbers we publish.
//
// Deploying and registering a treasury is free to the person doing it: our relay sponsors
// the fee, and passkey sign-up automates fine (a virtual WebAuthn authenticator is how our
// own E2E signed in). So "registered a treasury" alone cannot carry evidence weight. Moving
// value into one can't be faked for free — on testnet it takes an allocation from the
// dispenser, which is capped per wallet and per day.
//
// Kept pure and separate from the counting script so the rule is testable without a network.

/**
 * Fold a "holds value right now" observation into the snapshot's owners.
 *
 * Sticky by design: an owner seen funded stays counted forever. A balance is a reading of
 * this moment, but a user who withdrew their funds did not stop having been a user — without
 * stickiness the published count would go down as people cleaned up after themselves.
 *
 * @param owners  snapshot owners map, mutated in place with `funded: true`
 * @param fundedNow  owner keys whose treasuries hold value on this run
 * @returns counts of active (funded at some point) and pending (registered only) owners
 */
export function applyFunding(owners, fundedNow) {
  let active = 0;
  let pending = 0;
  for (const [owner, entry] of Object.entries(owners)) {
    if (fundedNow.has(owner)) entry.funded = true;
    if (entry.funded) active++;
    else pending++;
  }
  return { active, pending };
}
