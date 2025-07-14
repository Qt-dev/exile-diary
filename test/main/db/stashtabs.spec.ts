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

import StashTabs from '../../../src/main/db/stashtabs';
import DB from '../../../src/main/db/index';

const mockDB = DB as jest.Mocked<typeof DB>;

describe('StashTabs', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('insertStashData', () => {
    it('should insert stash data successfully with number timestamp', async () => {
      const timestamp = 1672574400000;
      const value = 1500;
      const rawData = '{"stash": "data", "items": []}';
      const league = 'Sanctum';
      mockDB.run.mockResolvedValue(undefined);

      const result = await StashTabs.insertStashData(timestamp, value, rawData, league);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO stashes(timestamp, value, items) VALUES(?, ?, ?)',
        [timestamp, value, rawData],
        league
      );
      expect(result).toBe(true);
    });

    it('should handle database insertion failure', async () => {
      const timestamp = 1672574400000;
      const value = 1500;
      const rawData = '{"stash": "data", "items": []}';
      const league = 'Sanctum';
      const mockError = new Error('Database insertion failed');
      mockDB.run.mockRejectedValue(mockError);

      const result = await StashTabs.insertStashData(timestamp, value, rawData, league);

      expect(result).toBe(false);
    });
  });

  describe('getStashData', () => {
    it('should retrieve stash data successfully', async () => {
      const timestamp = '1672574400000';
      const league = 'Sanctum';
      const mockResult = {
        items: '{"stash": "data", "items": []}',
        value: 1500,
      };
      mockDB.get.mockResolvedValue(mockResult);

      const result = await StashTabs.getStashData(timestamp, league);

      expect(mockDB.get).toHaveBeenCalledWith(
        'SELECT items, value FROM stashes WHERE timestamp <= ? ORDER BY timestamp DESC LIMIT 1',
        [timestamp],
        league
      );
      expect(result).toEqual(mockResult);
    });

    it('should return empty array when no data found', async () => {
      const timestamp = '1672574400000';
      const league = 'Sanctum';
      mockDB.get.mockResolvedValue(null);

      const result = await StashTabs.getStashData(timestamp, league);

      expect(result).toEqual([]);
    });

    it('should return "{}" when error occurs', async () => {
      const timestamp = '1672574400000';
      const league = 'Sanctum';
      const mockError = new Error('Database error');
      mockDB.get.mockRejectedValue(mockError);

      const result = await StashTabs.getStashData(timestamp, league);

      expect(result).toBe('{}');
    });
  });

  describe('getPreviousStashValue', () => {
    it('should retrieve previous stash value successfully', async () => {
      const timestamp = 1672574400000;
      const league = 'Sanctum';
      const mockResult = { value: 1200 };
      mockDB.get.mockResolvedValue(mockResult);

      const result = await StashTabs.getPreviousStashValue(timestamp, league);

      expect(mockDB.get).toHaveBeenCalledWith(
        'SELECT value FROM stashes WHERE timestamp < ? ORDER BY timestamp DESC LIMIT 1',
        [timestamp],
        league
      );
      expect(result).toBe(1200);
    });

    it('should return 0 when no previous data found', async () => {
      const timestamp = 1672574400000;
      const league = 'Sanctum';
      const mockError = new Error('No data');
      mockDB.get.mockRejectedValue(mockError);

      const result = await StashTabs.getPreviousStashValue(timestamp, league);

      expect(result).toBe(0);
    });
  });

  describe('getLatestStashAge', () => {
    it('should retrieve latest stash age successfully', async () => {
      const league = 'Sanctum';
      const mockResult = { timestamp: 1672574400000 };
      mockDB.get.mockResolvedValue(mockResult);

      const result = await StashTabs.getLatestStashAge(league);

      expect(mockDB.get).toHaveBeenCalledWith(
        "SELECT IFNULL(MAX(timestamp), -1) AS timestamp FROM stashes WHERE items <> '{}' ",
        [],
        league
      );
      expect(result).toBe(1672574400000);
    });

    it('should return -1 when error occurs', async () => {
      const league = 'Sanctum';
      const mockError = new Error('Database error');
      mockDB.get.mockRejectedValue(mockError);

      const result = await StashTabs.getLatestStashAge(league);

      expect(result).toBe(-1);
    });
  });

  describe('getRunsSinceLastCheck', () => {
    it('should retrieve runs count since last check', async () => {
      const date = 1672574400000;
      const mockResult = { count: 5 };
      mockDB.get.mockResolvedValue(mockResult);

      const result = await StashTabs.getRunsSinceLastCheck(date);

      expect(mockDB.get).toHaveBeenCalledWith(
        "SELECT count(1) as count FROM mapruns WHERE id > ? AND json_extract(runinfo, '$.ignored') IS NULL",
        [date]
      );
      expect(result).toBe(5);
    });

    it('should return 0 when error occurs', async () => {
      const date = 1672574400000;
      const mockError = new Error('Database error');
      mockDB.get.mockRejectedValue(mockError);

      const result = await StashTabs.getRunsSinceLastCheck(date);

      expect(result).toBe(0);
    });
  });

  describe('getLatestStashValue', () => {
    it('should retrieve latest stash value successfully', async () => {
      const league = 'Sanctum';
      const mockResult = [{ timestamp: 1672574400000, value: 2500, len: 150 }];
      mockDB.all.mockResolvedValue(mockResult);

      const result = await StashTabs.getLatestStashValue(league);

      expect(mockDB.all).toHaveBeenCalledWith(
        'SELECT timestamp, value, length(items) as len FROM stashes ORDER BY timestamp DESC LIMIT 1',
        [],
        league
      );
      expect(result).toEqual({ timestamp: 1672574400000, value: 2500, len: 150 });
    });

    it('should return default values when error occurs', async () => {
      const league = 'Sanctum';
      const mockError = new Error('Database error');
      mockDB.all.mockRejectedValue(mockError);

      const result = await StashTabs.getLatestStashValue(league);

      expect(result).toEqual({ timestamp: 0, value: 0, len: 0 });
    });
  });
});
