// Pure view-level filtering for the activity feed: chip groups collapse the mixed
// vocabulary of on-chain topic symbols and Supabase activity kinds into a handful of
// user-facing categories, and the treasury filter powers "my treasury only" views.
import type { FeedEvent } from "./events";

export type KindGroup =
  | "payments"
  | "blocked"
  | "fund"
  | "deploy"
  | "whitelist"
  | "leash"
  | "lifecycle"
  | "zk";

export const KIND_GROUPS: Record<KindGroup, readonly string[]> = {
  payments: ["paid"],
  blocked: ["blocked"],
  fund: ["fund"],
  deploy: ["deploy"],
  whitelist: ["whitelist", "payee_add", "payee_rm"],
  leash: ["leash", "revoked"],
  lifecycle: ["lifecycle", "paused", "agent"],
  zk: ["attested", "escrowed", "released", "refunded"],
};

const GROUP_OF: ReadonlyMap<string, KindGroup> = new Map(
  (Object.entries(KIND_GROUPS) as [KindGroup, readonly string[]][]).flatMap(([g, kinds]) =>
    kinds.map((k) => [k, g] as const),
  ),
);

export function groupOfKind(kind: string): KindGroup | null {
  return GROUP_OF.get(kind) ?? null;
}

export interface FeedFilter {
  groups: ReadonlySet<KindGroup> | null; // null = every kind
  treasuryId: string | null; // null = platform-wide
}

/** Events without a treasuryId are dropped when a treasury filter is active —
 *  platform-wide rows must not leak into a "my treasury" view. */
export function filterFeed(events: FeedEvent[], f: FeedFilter): FeedEvent[] {
  return events.filter((e) => {
    if (f.treasuryId && e.treasuryId !== f.treasuryId) return false;
    if (f.groups) {
      const g = groupOfKind(e.kind);
      if (!g || !f.groups.has(g)) return false;
    }
    return true;
  });
}
