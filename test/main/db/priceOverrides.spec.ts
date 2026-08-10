jest.mock('../../../src/main/db/index', () => ({
  initLeagueDB: jest.fn().mockResolvedValue(undefined),
  run: jest.fn(),
  all: jest.fn(),
  get: jest.fn(),
}));

jest.mock('electron-log', () => ({
  scope: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  })),
}));

import PriceOverridesRepository from '../../../src/main/db/repositories/priceOverrides';
import DB from '../../../src/main/db/index';

const mockDB = DB as jest.Mocked<typeof DB>;

describe('PriceOverridesRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setOverride', () => {
    it('should upsert a static price override and return the row', async () => {
      mockDB.run.mockResolvedValue(undefined as any);
      mockDB.all.mockResolvedValue([
        {
          item_identifier: 'Divine Orb',
          category: 'Currency',
          price: 150,
          currency_type: 'chaos',
          input_price: 150,
          updated_at: '2026-08-09 20:00:00',
        },
      ]);

      const result = await PriceOverridesRepository.setOverride({
        league: 'Settlers',
        itemIdentifier: 'Divine Orb',
        category: 'Currency',
        price: 150,
        currencyType: 'chaos',
        inputPrice: 150,
      });

      expect(mockDB.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO price_overrides'),
        ['Divine Orb', 'Currency', 150, 'chaos', 150],
        'Settlers'
      );
      expect(result).toBeDefined();
      expect(result?.item_identifier).toBe('Divine Orb');
      expect(result?.price).toBe(150);
    });
  });

  describe('getOverride', () => {
    it('should query static override for an item', async () => {
      mockDB.all.mockResolvedValue([
        {
          item_identifier: 'Mageblood',
          category: 'Unique Items',
          price: 45000,
          currency_type: 'divine',
          input_price: 300,
          updated_at: '2026-08-09 20:00:00',
        },
      ]);

      const result = await PriceOverridesRepository.getOverride('Settlers', 'Mageblood');

      expect(mockDB.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE item_identifier = ?'),
        ['Mageblood'],
        'Settlers'
      );
      expect(result?.price).toBe(45000);
      expect(result?.input_price).toBe(300);
    });
  });

  describe('deleteOverride', () => {
    it('should delete the override row for an item', async () => {
      mockDB.run.mockResolvedValue(undefined as any);

      const result = await PriceOverridesRepository.deleteOverride('Settlers', 'Mageblood');

      expect(mockDB.run).toHaveBeenCalledWith(
        'DELETE FROM price_overrides WHERE item_identifier = ?',
        ['Mageblood'],
        'Settlers'
      );
      expect(result).toBe(true);
    });
  });

  describe('getAllOverrides', () => {
    it('should return all static overrides for a league', async () => {
      mockDB.all.mockResolvedValue([
        {
          item_identifier: 'Divine Orb',
          category: 'Currency',
          price: 150,
          currency_type: 'chaos',
          input_price: 150,
          updated_at: '2026-08-09 20:00:00',
        },
      ]);

      const result = await PriceOverridesRepository.getAllOverrides('Settlers');
      expect(result).toHaveLength(1);
      expect(result[0].item_identifier).toBe('Divine Orb');
    });
  });
});
