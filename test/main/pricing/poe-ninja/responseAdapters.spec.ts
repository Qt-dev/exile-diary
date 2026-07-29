import {
  adaptPoeNinjaResponse,
  assembleLegacySnapshot,
} from '../../../../src/main/pricing/poe-ninja/responseAdapters';
import { POE_NINJA_CATEGORIES } from '../../../../src/main/pricing/poe-ninja/categoryCatalog';

describe('poe.ninja response adapters', () => {
  it('maps exchange ids to item names', () => {
    expect(
      adaptPoeNinjaResponse(POE_NINJA_CATEGORIES.Currency, {
        items: [{ id: 'divine', name: 'Divine Orb' }],
        lines: [{ id: 'divine', primaryValue: 175 }],
      })
    ).toEqual({ 'Divine Orb': 175 });
  });

  it('does not append undefined to base types without a variant', () => {
    expect(
      adaptPoeNinjaResponse(POE_NINJA_CATEGORIES.BaseType, {
        lines: [{ name: 'Vaal Regalia', levelRequired: 86, variant: null, chaosValue: 10 }],
      })
    ).toEqual({ 'Vaal Regalia L86': 10 });
  });

  it('uses the shared canonical gem identity', () => {
    expect(
      adaptPoeNinjaResponse(POE_NINJA_CATEGORIES.SkillGem, {
        lines: [
          {
            name: 'Fireball',
            baseType: 'Fireball',
            gemLevel: 21,
            gemQuality: 20,
            corrupted: true,
            chaosValue: 42,
          },
        ],
      })
    ).toEqual({ 'Fireball L21 Q20 (Corrupted)': 42 });
  });

  it('preserves the highest value when variants collapse to one identifier', () => {
    expect(
      adaptPoeNinjaResponse(POE_NINJA_CATEGORIES.UniqueMap, {
        lines: [
          { name: 'The Coward’s Trial', chaosValue: 4 },
          { name: 'The Coward’s Trial', chaosValue: 7 },
        ],
      })
    ).toEqual({ 'The Coward’s Trial': 7 });
  });

  it('assembles legacy tables without dropping unique relics', () => {
    const snapshot = assembleLegacySnapshot(
      { UniqueRelic: { 'The Original Scripture': 100 } },
      POE_NINJA_CATEGORIES
    );
    expect(snapshot.UniqueItem).toEqual({ 'The Original Scripture': 100 });
  });
});
