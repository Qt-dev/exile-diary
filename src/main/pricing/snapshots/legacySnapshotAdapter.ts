import type { LegacyPriceSnapshot, PriceSnapshot } from '../types';

export function readSnapshotCategories(
  snapshot: LegacyPriceSnapshot | PriceSnapshot | null | undefined
): LegacyPriceSnapshot {
  if (!snapshot) return {};
  if ('schemaVersion' in snapshot && snapshot.categories) {
    return snapshot.categories as LegacyPriceSnapshot;
  }
  return snapshot as LegacyPriceSnapshot;
}
