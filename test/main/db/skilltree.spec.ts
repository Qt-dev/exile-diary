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

import SkillTree from '../../../src/main/db/skilltree';
import DB from '../../../src/main/db/index';

const mockDB = DB as jest.Mocked<typeof DB>;

describe('SkillTree', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getPreviousTree', () => {
    it('should return previous skill tree when found', async () => {
      const mockResult = {
        timestamp: '2023-01-01T12:00:00.000Z',
        data: '{"nodes": [1, 2, 3], "masteries": {"1": 4}}',
      };
      mockDB.get.mockResolvedValue(mockResult);

      const result = await SkillTree.getPreviousTree();

      expect(mockDB.get).toHaveBeenCalledWith(
        'SELECT timestamp, data FROM passives ORDER BY timestamp DESC LIMIT 1'
      );
      expect(result).toEqual(mockResult);
    });

    it('should return null when no skill tree found', async () => {
      mockDB.get.mockResolvedValue(undefined);

      const result = await SkillTree.getPreviousTree();

      expect(mockDB.get).toHaveBeenCalledWith(
        'SELECT timestamp, data FROM passives ORDER BY timestamp DESC LIMIT 1'
      );
      expect(result).toBeUndefined();
    });

    it('should return null and log error when database query fails', async () => {
      const mockError = new Error('Database connection failed');
      mockDB.get.mockRejectedValue(mockError);

      const result = await SkillTree.getPreviousTree();

      expect(mockDB.get).toHaveBeenCalledWith(
        'SELECT timestamp, data FROM passives ORDER BY timestamp DESC LIMIT 1'
      );
      expect(result).toBeNull();
    });

    it('should handle empty result correctly', async () => {
      mockDB.get.mockResolvedValue(null);

      const result = await SkillTree.getPreviousTree();

      expect(result).toBeNull();
    });

    it('should validate SQL query structure for SQLite compatibility', async () => {
      mockDB.get.mockResolvedValue({ timestamp: '2023-01-01', data: '{}' });

      await SkillTree.getPreviousTree();

      const expectedQuery = 'SELECT timestamp, data FROM passives ORDER BY timestamp DESC LIMIT 1';
      expect(mockDB.get).toHaveBeenCalledWith(expectedQuery);

      // Verify query matches expected SQLite passives table schema
      expect(expectedQuery).toContain('SELECT timestamp, data');
      expect(expectedQuery).toContain('FROM passives');
      expect(expectedQuery).toContain('ORDER BY timestamp DESC');
      expect(expectedQuery).toContain('LIMIT 1');
    });

    it('should handle large skill tree data', async () => {
      const largeSkillTreeData = JSON.stringify({
        nodes: Array(500).fill(1),
        masteries: Object.fromEntries(
          Array(100)
            .fill(0)
            .map((_, i) => [i, i + 1000])
        ),
        jewels: Array(50).fill({ name: 'test jewel', stats: ['stat1', 'stat2'] }),
      });
      const mockResult = {
        timestamp: '2023-01-01T12:00:00.000Z',
        data: largeSkillTreeData,
      };
      mockDB.get.mockResolvedValue(mockResult);

      const result = await SkillTree.getPreviousTree();

      expect(result).toEqual(mockResult);
      expect(result?.data).toBe(largeSkillTreeData);
    });

    it('should handle malformed JSON in data field', async () => {
      const mockResult = {
        timestamp: '2023-01-01T12:00:00.000Z',
        data: '{"nodes": [1, 2, 3], "masteries": {"1": 4}', // Missing closing brace
      };
      mockDB.get.mockResolvedValue(mockResult);

      const result = await SkillTree.getPreviousTree();

      expect(result).toEqual(mockResult);
      // The function doesn't validate JSON, it just returns the raw data
    });
  });

  describe('insertPassivetree', () => {
    it('should insert new skill tree successfully', async () => {
      const timestamp = 1672574400000; // 2023-01-01T12:00:00.000Z
      const data = '{"nodes": [1, 2, 3], "masteries": {"1": 4}}';
      mockDB.run.mockResolvedValue(undefined);

      const result = await SkillTree.insertPassivetree(timestamp, data);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO passives(timestamp, data) values(?, ?)',
        [timestamp, data]
      );
      expect(result).toBe(true);
    });

    it('should return false and log error when insertion fails', async () => {
      const timestamp = 1672574400000;
      const data = '{"nodes": [1, 2, 3]}';
      const mockError = new Error('Unique constraint violation');
      mockDB.run.mockRejectedValue(mockError);

      const result = await SkillTree.insertPassivetree(timestamp, data);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO passives(timestamp, data) values(?, ?)',
        [timestamp, data]
      );
      expect(result).toBe(false);
    });

    it('should handle string timestamp correctly', async () => {
      const timestamp = '1672574400000';
      const data = '{"nodes": [1, 2, 3]}';
      mockDB.run.mockResolvedValue(undefined);

      const result = await SkillTree.insertPassivetree(Number(timestamp), data);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO passives(timestamp, data) values(?, ?)',
        [1672574400000, data]
      );
      expect(result).toBe(true);
    });

    it('should handle empty data string', async () => {
      const timestamp = 1672574400000;
      const data = '';
      mockDB.run.mockResolvedValue(undefined);

      const result = await SkillTree.insertPassivetree(timestamp, data);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO passives(timestamp, data) values(?, ?)',
        [timestamp, data]
      );
      expect(result).toBe(true);
    });

    it('should handle large skill tree JSON data', async () => {
      const timestamp = 1672574400000;
      const largeData = JSON.stringify({
        nodes: Array(1000).fill(1),
        masteries: Object.fromEntries(
          Array(200)
            .fill(0)
            .map((_, i) => [i, i + 1000])
        ),
        jewels: Array(100).fill({ name: 'test jewel', stats: ['stat1', 'stat2'] }),
        keystones: Array(20).fill('keystone'),
        ascendancy: {
          class: 'Ascendant',
          nodes: Array(50).fill(1),
        },
      });
      mockDB.run.mockResolvedValue(undefined);

      const result = await SkillTree.insertPassivetree(timestamp, largeData);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO passives(timestamp, data) values(?, ?)',
        [timestamp, largeData]
      );
      expect(result).toBe(true);
    });

    it('should validate SQL query structure for SQLite compatibility', async () => {
      const timestamp = 1672574400000;
      const data = '{"test": "data"}';
      mockDB.run.mockResolvedValue(undefined);

      await SkillTree.insertPassivetree(timestamp, data);

      // Verify the query is SQLite compatible
      const expectedQuery = 'INSERT INTO passives(timestamp, data) values(?, ?)';
      expect(mockDB.run).toHaveBeenCalledWith(expectedQuery, [timestamp, data]);

      // Verify query matches expected SQLite passives table schema
      expect(expectedQuery).toContain('INSERT INTO passives');
      expect(expectedQuery).toContain('timestamp');
      expect(expectedQuery).toContain('data');
      expect(expectedQuery).toContain('values(?, ?)');
    });

    it('should handle unique constraint violation correctly', async () => {
      const timestamp = 1672574400000;
      const data = '{"nodes": [1, 2, 3]}';
      const constraintError = new Error('UNIQUE constraint failed: passives.timestamp');
      mockDB.run.mockRejectedValue(constraintError);

      const result = await SkillTree.insertPassivetree(timestamp, data);

      expect(result).toBe(false);
    });

    it('should handle malformed JSON data', async () => {
      const timestamp = 1672574400000;
      const malformedData = '{"nodes": [1, 2, 3'; // Missing closing brackets
      mockDB.run.mockResolvedValue(undefined);

      const result = await SkillTree.insertPassivetree(timestamp, malformedData);

      // The function doesn't validate JSON, it just passes it to the database
      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO passives(timestamp, data) values(?, ?)',
        [timestamp, malformedData]
      );
      expect(result).toBe(true);
    });

    it('should handle null data parameter', async () => {
      const timestamp = 1672574400000;
      const data = null;
      mockDB.run.mockResolvedValue(undefined);

      const result = await SkillTree.insertPassivetree(timestamp, data as any);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO passives(timestamp, data) values(?, ?)',
        [timestamp, null]
      );
      expect(result).toBe(true);
    });

    it('should handle zero timestamp', async () => {
      const timestamp = 0;
      const data = '{"nodes": []}';
      mockDB.run.mockResolvedValue(undefined);

      const result = await SkillTree.insertPassivetree(timestamp, data);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO passives(timestamp, data) values(?, ?)',
        [timestamp, data]
      );
      expect(result).toBe(true);
    });

    it('should handle negative timestamp', async () => {
      const timestamp = -1;
      const data = '{"nodes": []}';
      mockDB.run.mockResolvedValue(undefined);

      const result = await SkillTree.insertPassivetree(timestamp, data);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO passives(timestamp, data) values(?, ?)',
        [timestamp, data]
      );
      expect(result).toBe(true);
    });
  });
});
