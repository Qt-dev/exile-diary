import {
  buildGemPriceIdentifier,
  buildForbiddenJewelIdentifier,
  buildShrineBeltIdentifier,
  extractForbiddenPassive,
  extractShrineNames,
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

  it('builds variant-safe Forbidden jewel identities from explicit mods', () => {
    const passive = extractForbiddenPassive([
      'Allocates Heart of Destruction if you have the matching modifier on Forbidden Flame',
    ]);
    expect(passive).toBe('Heart of Destruction');
    expect(buildForbiddenJewelIdentifier('Forbidden Flesh', passive!)).toBe(
      'Forbidden Flesh (Heart of Destruction)'
    );
  });

  it('sorts shrine belt variants to the API identity order', () => {
    const shrines = extractShrineNames([
      'You have Resistance Shrine Buff while affected by no Flasks',
      'You have Gloom Shrine Buff while affected by no Flasks',
    ]);
    expect(buildShrineBeltIdentifier('Screams of the Desiccated', shrines)).toBe(
      'Screams of the Desiccated (Gloom, Resistance)'
    );
  });
});
