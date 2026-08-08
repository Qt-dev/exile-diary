import { describe, expect, it } from '@jest/globals';
import { POE_NINJA_CATEGORIES, POE_NINJA_CATALOG_REVISION, buildPoeNinjaPath } from '../../../src/shared/pricing';

describe('publisher poe.ninja catalog', () => {
  it('routes the documented Flask stash category through the item overview', () => {
    expect(buildPoeNinjaPath('Flask', 'Hardcore Allflame')).toBe(
      '/poe1/api/economy/stash/current/item/overview?league=Hardcore%20Allflame&type=Flask'
    );
    expect(POE_NINJA_CATEGORIES.Flask).toEqual({
      endpoint: 'stash',
      adapter: 'baseType',
      destination: 'Flask',
      pricingSupport: 'unsupported',
    });
  });

  it('records the catalog revision used to invalidate prior publisher state', () => {
    expect(POE_NINJA_CATALOG_REVISION).toBe('2026-08-08.1');
  });
});
