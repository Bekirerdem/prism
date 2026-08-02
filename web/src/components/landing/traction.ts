/** Numbers read off the chain, not claims — the single place to update them until the
 *  counter is wired to a live query.
 *
 *  Source of truth: the treasury registry plus the activity table. Keep these conservative;
 *  the page's whole argument is that its evidence is checkable. */
export const TRACTION = { blocked: 20, treasuries: 13, actions: 76 };
