const fetchRatesForDayMock = jest.fn();

jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  scope: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  })),
}));

jest.mock('../../../../src/main/pricing/snapshots/PriceSnapshotStore', () => ({
  __esModule: true,
  default: {
    fetchRatesForDay: (...args: any[]) => fetchRatesForDayMock(...args),
  },
}));

jest.mock('../../../../src/main/SettingsManager', () => ({
  __esModule: true,
  default: {
    get: (key: string) =>
      key === 'activeProfile'
        ? { league: 'Allflame' }
        : key === 'alternateSplinterPricing'
          ? true
          : null,
  },
}));

jest.mock('../../../../src/main/modules/Utils', () => ({
  __esModule: true,
  default: { getItemName: jest.fn(() => '') },
}));

function rawItem(typeLine: string, stackSize = 1, overrides: Record<string, any> = {}) {
  return JSON.stringify({
    id: typeLine,
    name: '',
    baseType: typeLine,
    typeLine,
    frameType: 5,
    identified: true,
    ilvl: 0,
    stackSize,
    maxStackSize: 20,
    properties: [],
    explicitMods: [],
    implicitMods: [],
    ...overrides,
  });
}

async function priceWithRates(rates: Record<string, any>, item: Record<string, any>) {
  fetchRatesForDayMock.mockResolvedValue(rates);
  const ItemPricer =
    require('../../../../src/main/pricing/matching/ItemPricer').default;
  return ItemPricer.price(item, 'Allflame');
}

describe('ItemPricer current poe.ninja rules', () => {
  beforeEach(() => {
    jest.resetModules();
    fetchRatesForDayMock.mockReset();
  });

  it('prices Allflame Embers before the generic fragment rule and applies stack size', async () => {
    const result = await priceWithRates(
      {
        AllflameEmber: { 'Allflame Ember of Kulemak': 458.8 },
        Fragment: { 'Allflame Ember of Kulemak': 1 },
      },
      {
        id: 'ember-1',
        typeline: 'Allflame Ember of Kulemak',
        rarity: 'Currency',
        category: 'Map Fragment',
        stack_size: 2,
        raw_data: rawItem('Allflame Ember of Kulemak', 2),
        drop_time: '2026-07-29T12:00:00.000Z',
      }
    );

    expect(result.value).toBe(917.6);
    expect(result.explanation?.matchedRule).toBe('Allflame Embers');
    expect(result.explanation?.lookupTrail[0]).toEqual(
      expect.objectContaining({
        table: 'AllflameEmber',
        identifier: 'Allflame Ember of Kulemak',
        unitChaosValue: 458.8,
      })
    );
  });

  it('prices generic exchange currencies through the shared Currency table', async () => {
    const result = await priceWithRates(
      { Currency: { 'Runegraft of Blasphemy': 26.44 } },
      {
        id: 'runegraft-1',
        typeline: 'Runegraft of Blasphemy',
        rarity: 'Currency',
        category: 'Currency',
        stack_size: 3,
        raw_data: rawItem('Runegraft of Blasphemy', 3),
        drop_time: '2026-07-29T12:00:00.000Z',
      }
    );
    expect(result.value).toBeCloseTo(79.32);
    expect(result.explanation?.matchedRule).toBe('Currency');
  });

  it('does not mistake Omen equipment for stackable Omens', async () => {
    const result = await priceWithRates(
      { BaseType: { 'Omen Wand L86': 12 } },
      {
        id: 'omen-wand-1',
        typeline: 'Omen Wand',
        rarity: 'Normal',
        category: 'Wand',
        stack_size: 1,
        raw_data: rawItem('Omen Wand', 1, { frameType: 0, ilvl: 86, sockets: [] }),
        drop_time: '2026-07-29T12:00:00.000Z',
      }
    );
    expect(result.value).toBe(12);
    expect(result.explanation?.matchedRule).toBe('Non-Unique Bases');
  });

  it('prices Forbidden jewels by jewel type and allocated passive', async () => {
    const result = await priceWithRates(
      { UniqueItem: { 'Forbidden Flesh (Heart of Destruction)': 31280 } },
      {
        id: 'forbidden-1',
        name: 'Forbidden Flesh',
        typeline: 'Cobalt Jewel',
        rarity: 'Unique',
        category: 'Jewel',
        stack_size: 1,
        raw_data: rawItem('Cobalt Jewel', 1, {
          frameType: 3,
          explicitMods: [
            'Allocates Heart of Destruction if you have the matching modifier on Forbidden Flame',
          ],
        }),
        drop_time: '2026-07-29T12:00:00.000Z',
      }
    );
    expect(result.value).toBe(31280);
    expect(result.explanation?.matchedRule).toBe('Forbidden Jewel');
  });

  it('prices Shrine belts by their sorted shrine pair', async () => {
    const result = await priceWithRates(
      { UniqueItem: { 'Screams of the Desiccated (Gloom, Resistance)': 88 } },
      {
        id: 'shrine-belt-1',
        name: 'Screams of the Desiccated',
        typeline: 'Vanguard Belt',
        rarity: 'Unique',
        category: 'Belt',
        stack_size: 1,
        raw_data: rawItem('Vanguard Belt', 1, {
          frameType: 3,
          explicitMods: [
            'You have Resistance Shrine Buff while affected by no Flasks',
            'You have Gloom Shrine Buff while affected by no Flasks',
          ],
        }),
        drop_time: '2026-07-29T12:00:00.000Z',
      }
    );
    expect(result.value).toBe(88);
    expect(result.explanation?.matchedRule).toBe('Shrine Belt');
  });

  it('prices captured beasts by their species name', async () => {
    const result = await priceWithRates(
      { Currency: { 'Wild Bristle Matron': 156.4 } },
      {
        id: 'beast-1',
        name: 'Wild Bristle Matron',
        typeline: 'Wild Bristle Matron',
        rarity: 'Rare',
        category: 'Captured Beast',
        stack_size: 1,
        raw_data: rawItem('Wild Bristle Matron', 1, { frameType: 2 }),
        drop_time: '2026-07-29T12:00:00.000Z',
      }
    );
    expect(result.value).toBe(156.4);
    expect(result.explanation?.matchedRule).toBe('Captured Beast');
  });

  it('prices stacked Vials through the generic Currency rule', async () => {
    const result = await priceWithRates(
      { Currency: { 'Vial of Sacrifice': 312.8 } },
      {
        id: 'vial-1',
        typeline: 'Vial of Sacrifice',
        rarity: 'Currency',
        category: 'Currency',
        stack_size: 2,
        raw_data: rawItem('Vial of Sacrifice', 2),
        drop_time: '2026-07-29T12:00:00.000Z',
      }
    );
    expect(result.value).toBeCloseTo(625.6);
    expect(result.explanation?.matchedRule).toBe('Currency');
  });

  it('prices Invitations through their stash category table', async () => {
    const result = await priceWithRates(
      { Invitation: { 'Screaming Invitation': 110 } },
      {
        id: 'invitation-1',
        typeline: 'Screaming Invitation',
        rarity: 'Normal',
        category: 'Misc Map Item',
        stack_size: 1,
        raw_data: rawItem('Screaming Invitation', 1, { frameType: 0 }),
        drop_time: '2026-07-29T12:00:00.000Z',
      }
    );
    expect(result.value).toBe(110);
    expect(result.explanation?.matchedRule).toBe('Invitations');
  });

  it('prices unique Tinctures through the generic unique identity', async () => {
    const result = await priceWithRates(
      { UniqueItem: { 'Mightblood Ire': 1 } },
      {
        id: 'tincture-1',
        name: 'Mightblood Ire',
        typeline: 'Ironwood Tincture',
        rarity: 'Unique',
        category: 'Tincture',
        stack_size: 1,
        raw_data: rawItem('Ironwood Tincture', 1, { frameType: 3 }),
        drop_time: '2026-07-29T12:00:00.000Z',
      }
    );
    expect(result.value).toBe(1);
    expect(result.explanation?.matchedRule).toBe('Unique Items');
  });

  it('prices Valdo maps by their unique custom title', async () => {
    const result = await priceWithRates(
      { ValdoMap: { 'Echoing Turf': 41446 } },
      {
        id: 'valdo-1',
        name: 'Echoing Turf',
        typeline: 'Valdo Map',
        rarity: 'Foil',
        category: 'Map',
        stack_size: 1,
        raw_data: rawItem('Valdo Map', 1, { frameType: 9, baseType: 'Valdo Map' }),
        drop_time: '2026-07-29T12:00:00.000Z',
      }
    );
    expect(result.value).toBe(41446);
    expect(result.explanation?.matchedRule).toBe('Valdo Map');
  });

  it('prices tier-aggregated blighted maps before individual map series', async () => {
    const icon =
      'https://web.poecdn.com/image/Art/2DItems/Maps/Atlas2Maps/New/MapNumbers16.png?scale=1&mn=24&mt=0&mb=1';
    const result = await priceWithRates(
      { Map: { 'Blighted Map (Tier 16) Gen-24': 15 } },
      {
        id: 'blighted-1',
        typeline: 'Dunes Map',
        rarity: 'Rare',
        category: 'Map',
        stack_size: 1,
        raw_data: rawItem('Dunes Map', 1, {
          frameType: 2,
          icon,
          properties: [{ name: 'Map Tier', values: [['16', 0]] }],
        }),
        drop_time: '2026-07-29T12:00:00.000Z',
      }
    );
    expect(result.value).toBe(15);
    expect(result.explanation?.matchedRule).toBe('Blighted Map');
  });

  it('prices tier-aggregated Blight-ravaged maps with their distinct identity', async () => {
    const icon =
      'https://web.poecdn.com/image/Art/2DItems/Maps/Atlas2Maps/New/MapNumbers16.png?scale=1&mn=24&mt=0&mub=1';
    const result = await priceWithRates(
      { Map: { 'Blight-ravaged Map (Tier 16) Gen-24': 16.1 } },
      {
        id: 'ravaged-1',
        typeline: 'Dunes Map',
        rarity: 'Rare',
        category: 'Map',
        stack_size: 1,
        raw_data: rawItem('Dunes Map', 1, {
          frameType: 2,
          icon,
          properties: [{ name: 'Map Tier', values: [['16', 0]] }],
        }),
        drop_time: '2026-07-29T12:00:00.000Z',
      }
    );
    expect(result.value).toBe(16.1);
    expect(result.explanation?.matchedRule).toBe('Blighted Map');
  });
});
