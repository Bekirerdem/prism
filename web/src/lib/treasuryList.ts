// Merge the device-local treasury list with the on-chain registry: the registry is the
// source of truth (its entries are recoverable from any device), local-only ids are kept
// but flagged so the UI can nudge the user to register them.
export interface TreasuryRef {
  id: string;
  registered: boolean;
}

export function mergeTreasuries(localIds: string[], registryIds: string[]): TreasuryRef[] {
  const registry = new Set(registryIds);
  const localOnly = localIds.filter((id) => !registry.has(id));
  return [
    ...registryIds.map((id): TreasuryRef => ({ id, registered: true })),
    ...localOnly.map((id): TreasuryRef => ({ id, registered: false })),
  ];
}
