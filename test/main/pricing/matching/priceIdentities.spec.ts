import {
  buildGemPriceIdentifier,
  clusterItemLevelBucket,
} from '../../../../src/main/pricing/matching/priceIdentities';

describe('pricing identities', () => {
  it.each([
    [84, 84],
    [83, 75],
    [75, 75],
    [74, 50],
    [49, 1],
  ])('maps cluster item level %i to %i', (level, expected) => {
    expect(clusterItemLevelBucket(level)).toBe(expected);
  });

  it('normalizes gem level, quality, and corruption', () => {
    expect(buildGemPriceIdentifier('Fireball', 21, 21, true)).toBe(
      'Fireball L21 Q20 (Corrupted)'
    );
    expect(buildGemPriceIdentifier('Empower Support', 4, 20, false)).toBe(
      'Empower Support L4'
    );
  });
});
