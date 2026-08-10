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

jest.mock('../../../src/main/db/index', () => ({
  initLeagueDB: jest.fn().mockResolvedValue(undefined),
  all: jest.fn(),
  run: jest.fn(),
  get: jest.fn(),
}));

const mockGetFullRates = jest.fn();
jest.mock('../../../src/main/db/repositories/rates', () => ({
  __esModule: true,
  default: {
    getFullRates: (...args: any[]) => mockGetFullRates(...args),
  },
}));

const mockSetOverride = jest.fn();
const mockGetOverride = jest.fn();
const mockGetAllOverrides = jest.fn();
const mockDeleteOverride = jest.fn();

jest.mock('../../../src/main/db/repositories/priceOverrides', () => ({
  __esModule: true,
  default: {
    setOverride: (...args: any[]) => mockSetOverride(...args),
    getOverride: (...args: any[]) => mockGetOverride(...args),
    getAllOverrides: (...args: any[]) => mockGetAllOverrides(...args),
    deleteOverride: (...args: any[]) => mockDeleteOverride(...args),
  },
}));

const mockGetItemMarketTrend = jest.fn();
jest.mock('../../../src/main/pricing/poe-ninja/PoeNinjaClient', () => ({
  __esModule: true,
  default: {
    getCategory: jest.fn(),
    getItemMarketTrend: (...args: any[]) => mockGetItemMarketTrend(...args),
  },
}));

const mockUpdateItemValues = jest.fn();
const mockGetRunsFromDates = jest.fn();
const mockGetItemsFromRun = jest.fn();

jest.mock('../../../src/main/db/repositories/run', () => ({
  __esModule: true,
  default: {
    updateItemValues: (...args: any[]) => mockUpdateItemValues(...args),
    getRunsFromDates: (...args: any[]) => mockGetRunsFromDates(...args),
    getItemsFromRun: (...args: any[]) => mockGetItemsFromRun(...args),
  },
}));

const mockSettingsGet = jest.fn((key: string) => {
  if (key === 'activeProfile') return { league: 'Settlers' };
  if (key === 'priceHistoryWindowWeeks') return 1;
  return null;
});
jest.mock('../../../src/main/SettingsManager', () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockSettingsGet(...(args as [string])),
  },
}));

jest.mock('../../../src/main/pricing/matching/ItemPricer', () => ({
  __esModule: true,
  default: {
    getCurrencyByName: jest.fn(async (name) => (name === 'Divine Orb' ? 160 : 1)),
    getEffectivePrice: jest.fn(async (name) => ({ price: 160, isOverride: false })),
    price: jest.fn(async (item) => ({ value: 160, explanation: { matchedRule: 'Currency' } })),
    getRatesFor: jest.fn(async () => ({ Currency: { 'Divine Orb': 160 } })),
    extractItemIdentifier: jest.fn((item) => item.name || item.typeline),
    extractItemTimestamp: jest.fn(() => '20260809200000'),
  },
  extractItemTimestamp: jest.fn(() => '2026-08-09T20:00:00.000Z'),
  extractItemIdentifier: jest.fn((item) => item.name || item.typeline),
}));

jest.mock('../../../src/main/pricing/history/PricingHistoryStore', () => ({
  __esModule: true,
  pricingHistoryStore: {
    load: jest.fn().mockResolvedValue(undefined),
    eagerSync: jest.fn().mockResolvedValue(undefined),
    getItemHistory: jest.fn().mockResolvedValue([]),
    scheduleSave: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  },
}));

import PricesService from '../../../src/main/services/PricesService';
import DB from '../../../src/main/db/index';
import { pricingHistoryStore } from '../../../src/main/pricing/history/PricingHistoryStore';

const mockDB = DB as jest.Mocked<typeof DB>;

describe('PricesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCatalog', () => {
    it('should merge poe.ninja rate snapshot items with dropped stats and static overrides', async () => {
      // Mock dropped stats query result
      mockDB.all.mockResolvedValue([
        {
          item_name: 'Divine Orb',
          category: 'Currency',
          total_quantity: 5,
          total_value: 800,
        },
      ]);

      // Mock fullrates snapshot
      mockGetFullRates.mockResolvedValue({
        Currency: {
          'Divine Orb': 160,
          'Exalted Orb': 10,
        },
        DivinationCard: {
          'The Doctor': 900,
        },
      });

      // Mock static overrides
      mockGetAllOverrides.mockResolvedValue([
        {
          item_identifier: 'The Doctor',
          category: 'DivinationCard',
          price: 1200,
          currency_type: 'chaos',
          input_price: 1200,
          updated_at: '2026-08-09 20:00:00',
        },
      ]);

      const catalog = await PricesService.getCatalog({
        league: 'Settlers',
      });

      expect(catalog.length).toBeGreaterThanOrEqual(3);

      const divine = catalog.find((i) => i.name === 'Divine Orb');
      expect(divine).toBeDefined();
      expect(divine?.droppedQuantity).toBe(5);
      expect(divine?.totalChaosValue).toBe(800);
      expect(divine?.unitChaosPrice).toBe(160);

      const doctor = catalog.find((i) => i.name === 'The Doctor');
      expect(doctor).toBeDefined();
      expect(doctor?.hasOverride).toBe(true);
      expect(doctor?.unitChaosPrice).toBe(1200); // Overridden value
    });

    it('should search for items that have not been dropped', async () => {
      mockDB.all.mockResolvedValue([]); // No drops
      mockGetFullRates.mockResolvedValue({
        UniqueItem: {
          Mageblood: 35000,
          Headhunter: 6000,
        },
      });
      mockGetAllOverrides.mockResolvedValue([]);

      const catalog = await PricesService.getCatalog({
        search: 'Mageblood',
      });

      expect(catalog.length).toBe(1);
      expect(catalog[0].name).toBe('Mageblood');
      expect(catalog[0].droppedQuantity).toBe(0);
      expect(catalog[0].unitChaosPrice).toBe(35000);
    });

    it('should correctly extract market unit prices from structured PriceSnapshot (schemaVersion 1)', async () => {
      mockDB.all.mockResolvedValue([
        {
          item_name: 'Cosmic Fragment',
          category: 'Fragment',
          total_quantity: 4,
          total_value: 476,
        },
      ]);
      mockGetFullRates.mockResolvedValue({
        schemaVersion: 1,
        league: 'Allflame',
        fetchedAt: '2026-08-09T20:00:00Z',
        categories: {
          Fragment: {
            'Cosmic Fragment': 119,
            'Decaying Fragment': 45,
          },
        },
      });
      mockGetAllOverrides.mockResolvedValue([]);

      const catalog = await PricesService.getCatalog({
        league: 'Allflame',
      });

      const cosmic = catalog.find((i) => i.name === 'Cosmic Fragment');
      expect(cosmic).toBeDefined();
      expect(cosmic?.unitChaosPrice).toBe(119); // Defaults to market price, NOT zero
      expect(cosmic?.hasOverride).toBe(false);

      const decaying = catalog.find((i) => i.name === 'Decaying Fragment');
      expect(decaying).toBeDefined();
      expect(decaying?.unitChaosPrice).toBe(45); // Defaults to market price, NOT zero
    });
  });

  describe('getItemPriceDetails', () => {
    it('should fetch real market trend on demand from poe.ninja without DB queries', async () => {
      mockGetItemMarketTrend.mockResolvedValue([
        { time: '2026-08-08T00:00:00Z', price: 115.1 },
        { time: '2026-08-09T00:00:00Z', price: 118.1 },
        { time: '2026-08-10T00:00:00Z', price: 119.7 },
      ]);
      mockGetOverride.mockResolvedValue(null);
      mockDB.all.mockResolvedValue([]); // No drops in DB

      const details = await PricesService.getItemPriceDetails('Cosmic Fragment', 'Allflame');

      expect(mockGetItemMarketTrend).toHaveBeenCalledWith('Cosmic Fragment', 'Allflame');
      expect(details.sparkline).toHaveLength(3);
      expect(details.sparkline[2].price).toBe(119.7);
    });

    it('trims the returned sparkline to the configured priceHistoryWindowWeeks (default 1 week)', async () => {
      const now = new Date();
      const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

      (pricingHistoryStore.getItemHistory as jest.Mock).mockResolvedValue([
        { time: daysAgo(90), price: 100 }, // way outside any window
        { time: daysAgo(10), price: 110 }, // outside 1-week default
        { time: daysAgo(3), price: 120 }, // inside 1-week default
        { time: daysAgo(0), price: 130 },
      ]);
      mockGetOverride.mockResolvedValue(null);
      mockDB.all.mockResolvedValue([]);

      mockSettingsGet.mockImplementation((key: string) => {
        if (key === 'activeProfile') return { league: 'Settlers' };
        if (key === 'priceHistoryWindowWeeks') return 1;
        return null;
      });

      const details = await PricesService.getItemPriceDetails('Divine Orb', 'Settlers');

      expect(details.sparkline).toHaveLength(2);
      expect(details.sparkline.map((p) => p.price)).toEqual([120, 130]);
      expect(details.sparklineWindowWeeks).toBe(1);
    });

    it('returns the full history when priceHistoryWindowWeeks is "all"', async () => {
      const now = new Date();
      const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

      (pricingHistoryStore.getItemHistory as jest.Mock).mockResolvedValue([
        { time: daysAgo(90), price: 100 },
        { time: daysAgo(10), price: 110 },
        { time: daysAgo(3), price: 120 },
      ]);
      mockGetOverride.mockResolvedValue(null);
      mockDB.all.mockResolvedValue([]);

      mockSettingsGet.mockImplementation((key: string) => {
        if (key === 'activeProfile') return { league: 'Settlers' };
        if (key === 'priceHistoryWindowWeeks') return 'all';
        return null;
      });

      const details = await PricesService.getItemPriceDetails('Divine Orb', 'Settlers');

      expect(details.sparkline).toHaveLength(3);
      expect(details.sparklineWindowWeeks).toBe('all');
    });
  });

  describe('setOverride', () => {
    it('should convert divine input to chaos and save static override', async () => {
      mockSetOverride.mockResolvedValue({
        item_identifier: 'Mirror of Kalandra',
        price: 96000, // 600 div * 160 c
        currency_type: 'divine',
        input_price: 600,
        updated_at: '2026-08-09 20:00:00',
      });

      const result = await PricesService.setOverride({
        itemIdentifier: 'Mirror of Kalandra',
        price: 600,
        currencyType: 'divine',
        inputPrice: 600,
        league: 'Settlers',
      });

      expect(mockSetOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          itemIdentifier: 'Mirror of Kalandra',
          price: 96000, // 600 * 160
          currencyType: 'divine',
        })
      );
      expect(result?.price).toBe(96000);
    });
  });

  describe('recalculatePrices', () => {
    it('should recalculate runs within specified time range', async () => {
      mockGetRunsFromDates.mockResolvedValue([
        { id: 1, firstevent: '20260809200000', lastevent: '20260809201500' },
      ]);

      mockGetItemsFromRun.mockResolvedValue([
        { id: 101, event_id: 1, name: 'Divine Orb', value: 100, stack_size: 1 },
      ]);

      const result = await PricesService.recalculatePrices({
        relativeHours: 24,
      });

      expect(mockGetRunsFromDates).toHaveBeenCalled();
      expect(mockUpdateItemValues).toHaveBeenCalled();
      expect(result.updatedRuns).toBe(1);
      expect(result.updatedItems).toBe(1);
    });
  });
});
