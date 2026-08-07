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

  it('filters exchange lines with fewer than ten listings', () => {
    expect(
      adaptPoeNinjaResponse(POE_NINJA_CATEGORIES.Currency, {
        items: [
          { id: 'divine', name: 'Divine Orb' },
          { id: 'mirror', name: 'Mirror of Kalandra' },
        ],
        lines: [
          { id: 'divine', primaryValue: 175, count: 10 },
          { id: 'mirror', primaryValue: 100_000, count: 1 },
        ],
      })
    ).toEqual({ 'Divine Orb': 175 });
  });

  it('adapts the live Allflame Ember exchange identity', () => {
    expect(
      adaptPoeNinjaResponse(POE_NINJA_CATEGORIES.AllflameEmber, {
        items: [
          {
            id: 'allflame-ember-of-kulemak',
            name: 'Allflame Ember of Kulemak',
            category: 'AllflameEmbers',
          },
        ],
        lines: [{ id: 'allflame-ember-of-kulemak', primaryValue: 458.8 }],
      })
    ).toEqual({ 'Allflame Ember of Kulemak': 458.8 });
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

  it('preserves Forbidden Flame and Flesh as separate passive identities', () => {
    expect(
      adaptPoeNinjaResponse(POE_NINJA_CATEGORIES.ForbiddenJewel, {
        lines: [
          {
            name: 'Heart of Destruction',
            variant: 'Forbidden Flesh',
            metadata: { passiveName: 'Heart of Destruction' },
            chaosValue: 31280,
          },
          {
            name: 'Heart of Destruction',
            variant: 'Forbidden Flame',
            metadata: { passiveName: 'Heart of Destruction' },
            chaosValue: 30000,
          },
        ],
      })
    ).toEqual({
      'Forbidden Flesh (Heart of Destruction)': 31280,
      'Forbidden Flame (Heart of Destruction)': 30000,
    });
  });

  it('ignores malformed Forbidden jewel lines instead of creating undefined keys', () => {
    expect(
      adaptPoeNinjaResponse(POE_NINJA_CATEGORIES.ForbiddenJewel, {
        lines: [{ name: 'Heart of Destruction', chaosValue: 100 }],
      })
    ).toEqual({});
  });

  it('uses the unique Valdo title without coupling the lookup to its reward variant', () => {
    expect(
      adaptPoeNinjaResponse(POE_NINJA_CATEGORIES.ValdoMap, {
        lines: [
          {
            name: 'Echoing Turf',
            baseType: 'Valdo Map',
            variant: 'Foil Mageblood',
            chaosValue: 41446,
          },
        ],
      })
    ).toEqual({ 'Echoing Turf': 41446 });
  });

  it('drops ambiguous duplicate Valdo titles instead of assigning a misleading price', () => {
    expect(
      adaptPoeNinjaResponse(POE_NINJA_CATEGORIES.ValdoMap, {
        lines: [
          { name: 'Repeated Title', variant: 'Foil Mageblood', chaosValue: 100 },
          { name: 'Repeated Title', variant: 'Foil Headhunter', chaosValue: 50 },
        ],
      })
    ).toEqual({});
  });

  it('adapts captured Beasts by species name regardless of taxonomy metadata', () => {
    expect(
      adaptPoeNinjaResponse(POE_NINJA_CATEGORIES.Beast, {
        lines: [
          {
            name: 'Wild Bristle Matron',
            baseType: 'Gargantuans|Ursae|The Wilds',
            chaosValue: 156.4,
          },
        ],
      })
    ).toEqual({ 'Wild Bristle Matron': 156.4 });
  });

  it('retains Shrine belt variants instead of collapsing them by unique name', () => {
    expect(
      adaptPoeNinjaResponse(POE_NINJA_CATEGORIES.ShrineBelt, {
        lines: [
          {
            name: 'Screams of the Desiccated',
            baseType: 'Vanguard Belt',
            variant: 'Gloom, Resistance',
            chaosValue: 88,
          },
        ],
      })
    ).toEqual({
      'Screams of the Desiccated': 88,
      'Screams of the Desiccated (Gloom, Resistance)': 88,
    });
  });

  it('retains a bare-name fallback for identified variant uniques', () => {
    expect(
      adaptPoeNinjaResponse(POE_NINJA_CATEGORIES.UniqueAccessory, {
        lines: [
          { name: "Doryani's Invitation", variant: 'Cold', chaosValue: 20 },
          { name: "Doryani's Invitation", variant: 'Fire', chaosValue: 35 },
        ],
      })
    ).toEqual({
      "Doryani's Invitation": 35,
      "Doryani's Invitation (Cold)": 20,
      "Doryani's Invitation (Fire)": 35,
    });
  });

  it('keeps tier-aggregated blighted map identities', () => {
    expect(
      adaptPoeNinjaResponse(POE_NINJA_CATEGORIES.BlightedMap, {
        lines: [
          {
            name: 'Blighted Map (Tier 16)',
            variant: ', Gen-24',
            chaosValue: 15,
          },
        ],
      })
    ).toEqual({ 'Blighted Map (Tier 16) Gen-24': 15 });
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
