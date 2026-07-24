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

const fs = jest.requireActual('node:fs');
const path = jest.requireActual('node:path');

const frozenRates = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), 'test', 'Fixtures', 'migration-0', 'pricing', 'frozen-rates.json'),
    'utf8'
  )
);

const fetchRatesForDayMock = jest.fn(async () => frozenRates.rates);
const settingsGetMock = jest.fn((key: string) => {
  if (key === 'activeProfile') {
    return { league: 'Standard' };
  }

  if (key === 'alternateSplinterPricing') {
    return true;
  }

  return null;
});

jest.mock('../../../src/main/RatesManager', () => ({
  __esModule: true,
  default: {
    fetchRatesForDay: (...args: any[]) => fetchRatesForDayMock(...args),
  },
}));

jest.mock('../../../src/main/SettingsManager', () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => settingsGetMock(...args),
  },
}));

jest.mock('../../../src/main/modules/Utils', () => ({
  __esModule: true,
  default: {
    getItemName: jest.fn(() => ''),
  },
}));

describe('ItemPricer precision metadata', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns a snapshot id and lookup trail for replayable valuations', async () => {
    const ItemPricer = require('../../../src/main/modules/ItemPricer').default;

    const item = {
      id: 'divine-1',
      typeline: 'Divine Orb',
      rarity: 'Currency',
      category: 'Currency',
      stack_size: 1,
      raw_data: JSON.stringify({
        id: 'divine-1',
        name: '',
        baseType: 'Divine Orb',
        frameType: 5,
        icon: 'https://web.poecdn.com/image/Art/2DItems/Currency/CurrencyModValues.png',
        identified: true,
        ilvl: 0,
        inventoryId: 'MainInventory',
        league: 'Standard',
        maxStackSize: 20,
        stackSize: 1,
        typeLine: 'Divine Orb',
        verified: false,
        properties: [],
      }),
      drop_time: '2026-01-02T12:00:00.000Z',
    };

    const result = await ItemPricer.price(item, 'Standard');

    expect(result.value).toBe(175);
    expect(result.explanation).toEqual({
      snapshot: {
        snapshotId: 'Standard:20260102',
        date: '20260102',
        league: 'Standard',
        source: 'poe.ninja',
      },
      matchedRule: 'Currency',
      finalValue: 175,
      isVendorRecipe: false,
      item: {
        typeline: 'Divine Orb',
        rarity: 'Currency',
        category: 'Currency',
        stackSize: 1,
        rawItemStored: true,
      },
      lookupTrail: [
        {
          table: 'Currency',
          identifier: 'Divine Orb',
          unitChaosValue: 175,
          stackSize: 1,
          totalChaosValue: 175,
          matched: true,
          passedMinValueFilter: true,
        },
      ],
      notes: [],
    });
  });

  it('recognizes the Allflame map series generation', () => {
    const { MAP_SERIES } = require('../../../src/main/modules/ItemPricer');

    expect(MAP_SERIES).toContainEqual({ id: 25, name: 'Allflame' });
  });
});
