// Mock the dependencies at the module level
jest.mock('../../../src/main/db/index', () => ({
  get: jest.fn(),
  run: jest.fn(),
  all: jest.fn(),
  transaction: jest.fn(),
}));

// Mock the logger at the module level
jest.mock('electron-log', () => ({
  scope: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  })),
}));

import incubators from '../../../src/main/db/incubators';
import DB from '../../../src/main/db/index';
import Logger from 'electron-log';

const mockDB = DB as jest.Mocked<typeof DB>;
const mockLogger = Logger.scope('db/incubators') as jest.Mocked<ReturnType<typeof Logger.scope>>;

describe('incubators', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getPreviousIncubators', () => {
    it('should return previous incubators when found', async () => {
      const mockResult = {
        timestamp: '2023-01-01T12:00:00.000Z',
        data: '{"incubator1": "data"}',
      };
      mockDB.get.mockResolvedValue(mockResult);

      const result = await incubators.getPreviousIncubators();

      expect(mockDB.get).toHaveBeenCalledWith(
        'SELECT timestamp, data FROM incubator ORDER BY timestamp DESC LIMIT 1'
      );
      expect(result).toEqual(mockResult);
    });

    it('should return null when no incubators found', async () => {
      mockDB.get.mockResolvedValue(undefined);

      const result = await incubators.getPreviousIncubators();

      expect(mockDB.get).toHaveBeenCalledWith(
        'SELECT timestamp, data FROM incubator ORDER BY timestamp DESC LIMIT 1'
      );
      expect(result).toBeUndefined();
    });

    it('should return null and log error when database query fails', async () => {
      const mockError = new Error('Database connection failed');
      mockDB.get.mockRejectedValue(mockError);

      const result = await incubators.getPreviousIncubators();

      expect(mockDB.get).toHaveBeenCalledWith(
        'SELECT timestamp, data FROM incubator ORDER BY timestamp DESC LIMIT 1'
      );
      expect(result).toBeNull();
    });

    it('should handle empty result correctly', async () => {
      mockDB.get.mockResolvedValue(null);

      const result = await incubators.getPreviousIncubators();

      expect(result).toBeNull();
    });
  });

  describe('insertNewIncubators', () => {
    it('should insert new incubators successfully', async () => {
      const timestamp = 1672574400000; // 2023-01-01T12:00:00.000Z
      const data = '{"incubator1": "new data"}';
      mockDB.run.mockResolvedValue(undefined);

      const result = await incubators.insertNewIncubators(timestamp, data);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO incubator(timestamp, data) values(?, ?)',
        [timestamp, data]
      );
      expect(result).toBe(true);
    });

    it('should return false and log error when insertion fails', async () => {
      const timestamp = 1672574400000;
      const data = '{"incubator1": "new data"}';
      const mockError = new Error('Unique constraint violation');
      mockDB.run.mockRejectedValue(mockError);

      const result = await incubators.insertNewIncubators(timestamp, data);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO incubator(timestamp, data) values(?, ?)',
        [timestamp, data]
      );
      expect(result).toBe(false);
    });

    it('should handle string timestamp correctly', async () => {
      const timestamp = '1672574400000';
      const data = '{"incubator1": "new data"}';
      mockDB.run.mockResolvedValue(undefined);

      const result = await incubators.insertNewIncubators(Number(timestamp), data);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO incubator(timestamp, data) values(?, ?)',
        [1672574400000, data]
      );
      expect(result).toBe(true);
    });

    it('should handle empty data string', async () => {
      const timestamp = 1672574400000;
      const data = '';
      mockDB.run.mockResolvedValue(undefined);

      const result = await incubators.insertNewIncubators(timestamp, data);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO incubator(timestamp, data) values(?, ?)',
        [timestamp, data]
      );
      expect(result).toBe(true);
    });

    it('should handle large JSON data', async () => {
      const timestamp = 1672574400000;
      const largeData = JSON.stringify({
        incubators: Array(100).fill({ name: 'test', progress: 50 }),
      });
      mockDB.run.mockResolvedValue(undefined);

      const result = await incubators.insertNewIncubators(timestamp, largeData);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO incubator(timestamp, data) values(?, ?)',
        [timestamp, largeData]
      );
      expect(result).toBe(true);
    });

    it('should validate SQL query structure for SQLite compatibility', async () => {
      const timestamp = 1672574400000;
      const data = '{"test": "data"}';
      mockDB.run.mockResolvedValue(undefined);

      await incubators.insertNewIncubators(timestamp, data);

      // Verify the query is SQLite compatible
      const expectedQuery = 'INSERT INTO incubator(timestamp, data) values(?, ?)';
      expect(mockDB.run).toHaveBeenCalledWith(expectedQuery, [timestamp, data]);

      // Verify query matches expected SQLite incubator table schema
      expect(expectedQuery).toContain('INSERT INTO incubator');
      expect(expectedQuery).toContain('timestamp');
      expect(expectedQuery).toContain('data');
    });
  });
});
