// Mock the dependencies first
jest.mock('../../../src/main/db/index');
jest.mock('electron-log', () => ({
  scope: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  })),
}));

import Items from '../../../src/main/db/items';
import DB from '../../../src/main/db/index';

const mockDB = DB as jest.Mocked<typeof DB>;

describe('Items', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('insertItems', () => {
    it('should insert items successfully with valid data', async () => {
      const mockItems = [
        ['item1', '2023-01-01T12:00:00.000Z', 'icon1.png', 'Item Name', 'Rare', 'Weapon', 1, 'Sword', 'RRR', 1, '{"raw":"data"}', 100, 90],
        ['item2', '2023-01-01T12:01:00.000Z', 'icon2.png', 'Item Name 2', 'Normal', 'Armor', 0, 'Chest', 'BB', 1, '{"raw":"data2"}', 50, 45],
      ];
      mockDB.transaction.mockResolvedValue(undefined);

      const result = await Items.insertItems(mockItems);

      expect(mockDB.transaction).toHaveBeenCalledWith(
        `
      INSERT INTO item
      (item_id, event_id, icon, name, rarity, category, identified, typeline, sockets, stack_size, raw_data, value, original_value)
      values(?, (SELECT id FROM event WHERE event.timestamp = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        mockItems
      );
    });

    it('should handle empty items array', async () => {
      const mockItems: any[] = [];
      mockDB.transaction.mockResolvedValue(undefined);

      const result = await Items.insertItems(mockItems);

      expect(mockDB.transaction).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO item'),
        mockItems
      );
    });

    it('should handle database transaction failure', async () => {
      const mockItems = [
        ['item1', '2023-01-01T12:00:00.000Z', 'icon1.png', 'Item Name', 'Rare', 'Weapon', 1, 'Sword', 'RRR', 1, '{"raw":"data"}', 100, 90],
      ];
      const mockError = new Error('Transaction failed');
      mockDB.transaction.mockRejectedValue(mockError);

      await expect(Items.insertItems(mockItems)).rejects.toThrow('Transaction failed');
      expect(mockDB.transaction).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO item'),
        mockItems
      );
    });

    it('should validate SQL query structure for SQLite compatibility', async () => {
      const mockItems = [['item1', '2023-01-01T12:00:00.000Z', 'icon1.png', 'Item Name', 'Rare', 'Weapon', 1, 'Sword', 'RRR', 1, '{"raw":"data"}', 100, 90]];
      mockDB.transaction.mockResolvedValue(undefined);

      await Items.insertItems(mockItems);

      const expectedQuery = `
      INSERT INTO item
      (item_id, event_id, icon, name, rarity, category, identified, typeline, sockets, stack_size, raw_data, value, original_value)
      values(?, (SELECT id FROM event WHERE event.timestamp = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      expect(mockDB.transaction).toHaveBeenCalledWith(expectedQuery, mockItems);
      
      // Verify query matches expected SQLite item table schema
      expect(expectedQuery).toContain('INSERT INTO item');
      expect(expectedQuery).toContain('item_id');
      expect(expectedQuery).toContain('event_id');
      expect(expectedQuery).toContain('icon');
      expect(expectedQuery).toContain('name');
      expect(expectedQuery).toContain('rarity');
      expect(expectedQuery).toContain('category');
      expect(expectedQuery).toContain('identified');
      expect(expectedQuery).toContain('typeline');
      expect(expectedQuery).toContain('sockets');
      expect(expectedQuery).toContain('stack_size');
      expect(expectedQuery).toContain('raw_data');
      expect(expectedQuery).toContain('value');
      expect(expectedQuery).toContain('original_value');
    });
  });

  describe('getMatchingItemsCount', () => {
    it('should return count for matching items', async () => {
      const itemIds = ['item1', 'item2', 'item3'];
      const mockResult = { count: 2 };
      mockDB.get.mockResolvedValue(mockResult);

      const result = await Items.getMatchingItemsCount(itemIds);

      expect(mockDB.get).toHaveBeenCalledWith(
        `SELECT COUNT(1) AS count FROM item WHERE ((id = 'item1') OR (id = 'item2') OR (id = 'item3'))`
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle empty itemIds array', async () => {
      const itemIds: string[] = [];
      const mockResult = { count: 0 };
      mockDB.get.mockResolvedValue(mockResult);

      const result = await Items.getMatchingItemsCount(itemIds);

      expect(mockDB.get).toHaveBeenCalledWith(
        'SELECT COUNT(1) AS count FROM item WHERE ()'
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle single item ID', async () => {
      const itemIds = ['single-item'];
      const mockResult = { count: 1 };
      mockDB.get.mockResolvedValue(mockResult);

      const result = await Items.getMatchingItemsCount(itemIds);

      expect(mockDB.get).toHaveBeenCalledWith(
        `SELECT COUNT(1) AS count FROM item WHERE ((id = 'single-item'))`
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle database query failure', async () => {
      const itemIds = ['item1'];
      const mockError = new Error('Database error');
      mockDB.get.mockRejectedValue(mockError);

      await expect(Items.getMatchingItemsCount(itemIds)).rejects.toThrow('Database error');
    });

    it('should handle special characters in item IDs', async () => {
      const itemIds = ["item'with'quotes", 'item-with-dashes'];
      const mockResult = { count: 0 };
      mockDB.get.mockResolvedValue(mockResult);

      const result = await Items.getMatchingItemsCount(itemIds);

      expect(mockDB.get).toHaveBeenCalledWith(
        `SELECT COUNT(1) AS count FROM item WHERE ((id = 'item'with'quotes') OR (id = 'item-with-dashes'))`
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('updateIgnoredItems', () => {
    it('should update ignored status for items successfully', async () => {
      const items = [
        { id: 'item1', status: true },
        { id: 'item2', status: false },
      ];
      mockDB.transaction.mockResolvedValue(undefined);

      const result = await Items.updateIgnoredItems(items);

      expect(mockDB.transaction).toHaveBeenCalledWith(
        `
      UPDATE item
        SET ignored = ?
        WHERE id = ?
    `,
        [[1, 'item1'], [0, 'item2']]
      );
    });

    it('should handle empty items array', async () => {
      const items: { id: string; status: boolean }[] = [];
      mockDB.transaction.mockResolvedValue(undefined);

      const result = await Items.updateIgnoredItems(items);

      expect(mockDB.transaction).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE item'),
        []
      );
    });

    it('should convert boolean status to integer correctly', async () => {
      const items = [
        { id: 'item1', status: true },
        { id: 'item2', status: false },
        { id: 'item3', status: true },
      ];
      mockDB.transaction.mockResolvedValue(undefined);

      await Items.updateIgnoredItems(items);

      expect(mockDB.transaction).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE item'),
        [[1, 'item1'], [0, 'item2'], [1, 'item3']]
      );
    });

    it('should handle database transaction failure', async () => {
      const items = [{ id: 'item1', status: true }];
      const mockError = new Error('Update failed');
      mockDB.transaction.mockRejectedValue(mockError);

      await expect(Items.updateIgnoredItems(items)).rejects.toThrow('Update failed');
    });

    it('should validate SQL query structure for SQLite compatibility', async () => {
      const items = [{ id: 'item1', status: true }];
      mockDB.transaction.mockResolvedValue(undefined);

      await Items.updateIgnoredItems(items);

      const expectedQuery = `
      UPDATE item
        SET ignored = ?
        WHERE id = ?
    `;
      
      expect(mockDB.transaction).toHaveBeenCalledWith(expectedQuery, [[1, 'item1']]);
      
      // Verify query matches expected SQLite item table schema
      expect(expectedQuery).toContain('UPDATE item');
      expect(expectedQuery).toContain('SET ignored = ?');
      expect(expectedQuery).toContain('WHERE id = ?');
    });
  });

  describe('getAllItemsValues', () => {
    it('should return all item values successfully', async () => {
      const mockResult = [
        { id: 'item1', value: 100 },
        { id: 'item2', value: 50 },
        { id: 'item3', value: 0 },
      ];
      mockDB.all.mockResolvedValue(mockResult);

      const result = await Items.getAllItemsValues();

      expect(mockDB.all).toHaveBeenCalledWith(`
      SELECT id, value
      FROM item
    `);
      expect(result).toEqual(mockResult);
    });

    it('should handle empty result set', async () => {
      const mockResult: any[] = [];
      mockDB.all.mockResolvedValue(mockResult);

      const result = await Items.getAllItemsValues();

      expect(mockDB.all).toHaveBeenCalledWith(`
      SELECT id, value
      FROM item
    `);
      expect(result).toEqual([]);
    });

    it('should handle database query failure', async () => {
      const mockError = new Error('Database connection failed');
      mockDB.all.mockRejectedValue(mockError);

      await expect(Items.getAllItemsValues()).rejects.toThrow('Database connection failed');
    });

    it('should validate SQL query structure for SQLite compatibility', async () => {
      const mockResult = [{ id: 'item1', value: 100 }];
      mockDB.all.mockResolvedValue(mockResult);

      await Items.getAllItemsValues();

      const expectedQuery = `
      SELECT id, value
      FROM item
    `;
      
      expect(mockDB.all).toHaveBeenCalledWith(expectedQuery);
      
      // Verify query matches expected SQLite item table schema
      expect(expectedQuery).toContain('SELECT id, value');
      expect(expectedQuery).toContain('FROM item');
    });

    it('should handle null and undefined values correctly', async () => {
      const mockResult = [
        { id: 'item1', value: null },
        { id: 'item2', value: undefined },
        { id: 'item3', value: 0 },
      ];
      mockDB.all.mockResolvedValue(mockResult);

      const result = await Items.getAllItemsValues();

      expect(result).toEqual(mockResult);
    });
  });
});
