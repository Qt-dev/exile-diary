import { readSnapshotCategories } from '../../../../src/main/pricing/snapshots/legacySnapshotAdapter';

describe('legacy price snapshot adapter', () => {
  it('leaves historical top-level snapshots readable', () => {
    const legacy = { Currency: { 'Divine Orb': 175 } };
    expect(readSnapshotCategories(legacy)).toBe(legacy);
  });

  it('unwraps schema-versioned snapshots', () => {
    expect(
      readSnapshotCategories({
        schemaVersion: 2,
        provider: 'poe.ninja',
        leagueId: 'Allflame',
        fetchedAt: '2026-07-29T00:00:00.000Z',
        categories: { Currency: { 'Divine Orb': 175 } },
      })
    ).toEqual({ Currency: { 'Divine Orb': 175 } });
  });
});
