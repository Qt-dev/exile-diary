import {
  EXCHANGE_CATEGORIES,
  POE_NINJA_CATEGORIES,
  STASH_CATEGORIES,
  buildPoeNinjaPath,
  type PoeNinjaCategory,
} from '../../../../src/main/pricing/poe-ninja/categoryCatalog';

describe('poe.ninja category catalog', () => {
  it.each(['Currency', 'Runegraft', 'AllflameEmber'] as PoeNinjaCategory[])(
    'routes %s through exchange overview',
    (category) => {
      expect(buildPoeNinjaPath(category, 'Hardcore Allflame')).toBe(
        `/poe1/api/economy/exchange/current/overview?league=Hardcore%20Allflame&type=${category}`
      );
    }
  );

  it.each([
    'Map',
    'Incubator',
    'Invitation',
    'Memory',
    'Beast',
    'Vial',
    'ForbiddenJewel',
    'UniqueTincture',
    'ValdoMap',
    'IncursionTemple',
  ] as PoeNinjaCategory[])('routes %s through stash overview', (category) => {
    expect(buildPoeNinjaPath(category, 'Allflame')).toContain(
      '/poe1/api/economy/stash/current/item/overview?'
    );
    expect(POE_NINJA_CATEGORIES[category].endpoint).toBe('stash');
  });

  it('declares an adapter and destination for every category', () => {
    expect(Object.keys(POE_NINJA_CATEGORIES).sort()).toEqual(
      [...EXCHANGE_CATEGORIES, ...STASH_CATEGORIES].sort()
    );
    for (const definition of Object.values(POE_NINJA_CATEGORIES)) {
      expect(definition.adapter).toBeTruthy();
      expect(definition.destination).toBeTruthy();
      expect(['direct', 'specialized', 'historical', 'unsupported']).toContain(
        definition.pricingSupport
      );
    }
  });

  it('marks categories without a proven local identity explicitly unsupported', () => {
    expect(POE_NINJA_CATEGORIES.ImbuedGem.pricingSupport).toBe('unsupported');
    expect(POE_NINJA_CATEGORIES.IncursionTemple.pricingSupport).toBe('unsupported');
    expect(POE_NINJA_CATEGORIES.Memory.pricingSupport).toBe('historical');
  });

  it.each(['Runegraft', 'DjinnCoin', 'Ducat', 'EnshroudingCrystal', 'Astrolabe'] as const)(
    'routes %s through the generic Currency pricing identity',
    (category) => {
      expect(POE_NINJA_CATEGORIES[category]).toEqual(
        expect.objectContaining({
          endpoint: 'exchange',
          adapter: 'exchange',
          destination: 'Currency',
          pricingSupport: 'direct',
        })
      );
    }
  );
});
