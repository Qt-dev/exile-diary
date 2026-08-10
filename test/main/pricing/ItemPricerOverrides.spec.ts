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

const mockGetOverride = jest.fn();

jest.mock('../../../src/main/db/repositories/priceOverrides', () => ({
  __esModule: true,
  default: {
    getOverride: (...args: any[]) => mockGetOverride(...args),
  },
}));

const fetchRatesForDayMock = jest.fn();

jest.mock('../../../src/main/pricing/snapshots/PriceSnapshotStore', () => ({
  __esModule: true,
  default: {
    fetchRatesForDay: (...args: any[]) => fetchRatesForDayMock(...args),
  },
}));

jest.mock('../../../src/main/SettingsManager', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => ({ league: 'Settlers' })),
  },
}));

jest.mock('../../../src/main/modules/Utils', () => ({
  __esModule: true,
  default: {
    getItemName: jest.fn(() => ''),
    getBase64EncodedData: jest.fn(() => ({})),
  },
}));

import ItemPricer from '../../../src/main/pricing/matching/ItemPricer';

describe('ItemPricer Static Price Overrides', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should use the static overridden price across historical items', async () => {
    mockGetOverride.mockResolvedValue({
      item_identifier: 'Divine Orb',
      price: 200,
      currency_type: 'chaos',
      input_price: 200,
      updated_at: '2026-08-09 20:00:00',
    });

    const item = {
      typeline: 'Divine Orb',
      rarity: 'Currency',
      category: 'Currency',
      stack_size: 3,
      drop_time: '2026-08-09T20:05:00.000Z',
    };

    const result = await ItemPricer.price(item, 'Settlers');

    expect(result.value).toBe(600); // 200 * 3
    expect(result.explanation?.matchedRule).toBe('Static Price Override');
    expect(result.explanation?.lookupTrail[0]?.unitChaosValue).toBe(200);
  });

  it('KEY TEST: should use overridden price even if API rates are unavailable or broken', async () => {
    // API returns empty / broken rates
    fetchRatesForDayMock.mockResolvedValue({});

    // User override is active
    mockGetOverride.mockResolvedValue({
      item_identifier: 'Mageblood',
      price: 35000,
      currency_type: 'chaos',
      input_price: 35000,
      updated_at: '2026-08-09 20:00:00',
    });

    const item = {
      name: 'Mageblood',
      typeline: 'Heavy Belt',
      rarity: 'Unique',
      category: 'UniqueItem',
      stack_size: 1,
      drop_time: '2026-08-09T20:10:00.000Z',
    };

    const result = await ItemPricer.price(item, 'Settlers');

    expect(result.value).toBe(35000);
    expect(result.explanation?.matchedRule).toBe('Static Price Override');
  });

  it('should fall back to underlying rates when no override exists', async () => {
    mockGetOverride.mockResolvedValue(null);

    fetchRatesForDayMock.mockResolvedValue({
      Currency: {
        'Chaos Orb': 1,
        'Exalted Orb': 15,
      },
    });

    const item = {
      typeline: 'Exalted Orb',
      rarity: 'Currency',
      category: 'Currency',
      stack_size: 2,
      drop_time: '2026-08-09T20:10:00.000Z',
      raw_data: JSON.stringify({ sockets: [] }),
    };

    const result = await ItemPricer.price(item, 'Settlers');

    expect(result.value).toBe(30); // 15 * 2
    expect(result.explanation?.matchedRule).not.toBe('Static Price Override');
  });
});
