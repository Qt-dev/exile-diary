
// Mock the dependencies first
jest.mock('../../../src/main/db/index');
jest.mock('dayjs');
jest.mock('electron-log', () => ({
  scope: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  })),
}));

import stats from '../../../src/main/db/stats';
import DB from '../../../src/main/db/index';
import dayjs from 'dayjs';

const mockDB = DB as jest.Mocked<typeof DB>;
const mockDayjs = dayjs as jest.MockedFunction<typeof dayjs>;

describe('stats', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Setup dayjs mock
    (mockDayjs as any).mockReturnValue({
      subtract: jest.fn().mockReturnThis(),
      format: jest.fn().mockReturnValue('20230101120000'),
    });
  });

  describe('getAllRuns', () => {
    it('should return all runs with complex query data', async () => {
      const mockRuns = [
        {
          id: 1,
          name: 'Test Map',
          level: 83,
          iiq: 75,
          iir: 150,
          pack_size: 20,
          conqueror_deaths: 0,
          mastermind_deaths: 1,
          sirus_deaths: 0,
        },
        {
          id: 2,
          name: 'Another Map',
          level: 84,
          iiq: 80,
          iir: 200,
          pack_size: 25,
          conqueror_deaths: 2,
          mastermind_deaths: 0,
          sirus_deaths: 1,
        },
      ];
      mockDB.all.mockResolvedValue(mockRuns);

      const result = await stats.getAllRuns();

      expect(mockDB.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT')
      );
      expect(result).toEqual(mockRuns);
    });

    it('should return empty array when database query fails', async () => {
      const mockError = new Error('Database connection failed');
      mockDB.all.mockRejectedValue(mockError);

      const result = await stats.getAllRuns();

      expect(result).toEqual([]);
    });

    it('should handle empty result set', async () => {
      mockDB.all.mockResolvedValue([]);

      const result = await stats.getAllRuns();

      expect(result).toEqual([]);
    });

    it('should validate complex SQL query structure for SQLite compatibility', async () => {
      mockDB.all.mockResolvedValue([]);

      await stats.getAllRuns();

      // Get the query that was called
      const calledQuery = mockDB.all.mock.calls[0][0];
      
      // Verify it contains expected SQLite elements
      expect(calledQuery).toContain('SELECT');
      expect(calledQuery).toContain('FROM area_info, run');
      expect(calledQuery).toContain('LEFT JOIN');
      expect(calledQuery).toContain('WHERE run.id = area_info.run_id');
      expect(calledQuery).toContain('json_extract(run_info');
      expect(calledQuery).toContain('ORDER BY run.id desc');
      
      // Verify battle-specific death counts
      expect(calledQuery).toContain('conqueror_deaths');
      expect(calledQuery).toContain('mastermind_deaths');
      expect(calledQuery).toContain('sirus_deaths');
      expect(calledQuery).toContain('shaper_deaths');
      expect(calledQuery).toContain('maven_deaths');
      expect(calledQuery).toContain('oshabi_deaths');
      expect(calledQuery).toContain('venarius_deaths');
    });
  });

  describe('getAllItems', () => {
    it('should return all items for a league', async () => {
      const league = 'Sanctum';
      const mockItems = [
        {
          map_id: 1,
          area: 'Test Map',
          id: 'item1',
          name: 'Test Item',
          value: 100,
          ignored: 0,
        },
        {
          map_id: 2,
          area: 'Another Map',
          id: 'item2',
          name: 'Test Item 2',
          value: 200,
          ignored: 0,
        },
      ];
      mockDB.all.mockResolvedValue(mockItems);

      const result = await stats.getAllItems(league);

      expect(mockDB.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT run.id AS map_id, area_info.name AS area, item.*')
      );
      expect(result).toEqual(mockItems);
    });

    it('should return empty array when no items found', async () => {
      const league = 'Standard';
      mockDB.all.mockResolvedValue(null);

      const result = await stats.getAllItems(league);

      expect(result).toEqual([]);
    });

    it('should return empty array when database query fails', async () => {
      const league = 'Hardcore';
      const mockError = new Error('Database error');
      mockDB.all.mockRejectedValue(mockError);

      const result = await stats.getAllItems(league);

      expect(result).toEqual([]);
    });

    it('should validate SQL query structure for item selection', async () => {
      const league = 'Test';
      mockDB.all.mockResolvedValue([]);

      await stats.getAllItems(league);

      const calledQuery = mockDB.all.mock.calls[0][0];
      
      // Verify query structure
      expect(calledQuery).toContain('SELECT run.id AS map_id, area_info.name AS area, item.*');
      expect(calledQuery).toContain('FROM item, run, area_info, event');
      expect(calledQuery).toContain('WHERE event.id = item.event_id');
      expect(calledQuery).toContain('AND item.ignored = 0');
      expect(calledQuery).toContain('AND DATETIME(event.timestamp) BETWEEN DATETIME(run.first_event) AND DATETIME(run.last_event)');
      expect(calledQuery).toContain('AND run.id = area_info.run_id');
    });
  });

  describe('getAllItemsForDates', () => {
    it('should return items within date range above minimum value', async () => {
      const from = '2023-01-01';
      const to = '2023-01-31';
      const minLootValue = 50;
      const mockItems = [
        { id: 'item1', value: 100, area: 'Test Map' },
        { id: 'item2', value: 200, area: 'Another Map' },
      ];
      mockDB.all.mockResolvedValue(mockItems);

      const result = await stats.getAllItemsForDates(from, to, minLootValue);

      expect(mockDB.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE item.value > ?'),
        [minLootValue, from, to]
      );
      expect(result).toEqual(mockItems);
    });

    it('should use default minimum value of 0', async () => {
      const from = '2023-01-01';
      const to = '2023-01-31';
      mockDB.all.mockResolvedValue([]);

      await stats.getAllItemsForDates(from, to);

      expect(mockDB.all).toHaveBeenCalledWith(
        expect.any(String),
        [0, from, to]
      );
    });

    it('should return empty array when database query fails', async () => {
      const from = '2023-01-01';
      const to = '2023-01-31';
      const mockError = new Error('Database error');
      mockDB.all.mockRejectedValue(mockError);

      const result = await stats.getAllItemsForDates(from, to);

      expect(result).toEqual([]);
    });

    it('should validate date range query structure', async () => {
      const from = '2023-01-01';
      const to = '2023-01-31';
      const minLootValue = 100;
      mockDB.all.mockResolvedValue([]);

      await stats.getAllItemsForDates(from, to, minLootValue);

      const calledQuery = mockDB.all.mock.calls[0][0];
      
      expect(calledQuery).toContain('WHERE item.value > ?');
      expect(calledQuery).toContain('AND DATETIME(run.first_event) BETWEEN DATETIME(?) AND DATETIME(?)');
    });
  });

  describe('getAllRunsForDates', () => {
    it('should return filtered runs with complex parameters', async () => {
      const params = {
        from: '2023-01-01',
        to: '2023-01-31',
        neededItemName: 'Divine Orb',
        selectedMaps: ['Tower Map', 'Cemetery Map'],
        selectedMods: ['Increased Monster Life', 'Added Fire Damage'],
        minMapValue: 100,
        iiq: { min: 70, max: 150 },
        iir: { min: 100, max: 300 },
        mapLevel: { min: 80, max: 85 },
        packSize: { min: 15, max: 30 },
        deaths: { min: 0, max: 2 },
      };
      const mockRuns = [
        { id: 1, name: 'Tower Map', level: 83, gained: 150 },
        { id: 2, name: 'Cemetery Map', level: 84, gained: 200 },
      ];
      mockDB.all.mockResolvedValue(mockRuns);

      const result = await stats.getAllRunsForDates(params);

      expect(mockDB.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining([
          params.neededItemName,
          ...params.selectedMods,
          ...params.selectedMaps,
          params.minMapValue,
          params.from,
          params.to,
        ])
      );
      expect(result).toEqual(mockRuns);
    });

    it('should handle minimal parameters', async () => {
      const params = {
        from: '2023-01-01',
        to: '2023-01-31',
        neededItemName: '',
        selectedMaps: [],
        selectedMods: [],
        minMapValue: 0,
      };
      mockDB.all.mockResolvedValue([]);

      const result = await stats.getAllRunsForDates(params);

      expect(mockDB.all).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([params.minMapValue, params.from, params.to])
      );
      expect(result).toEqual([]);
    });

    it('should return empty array when database query fails', async () => {
      const params = {
        from: '2023-01-01',
        to: '2023-01-31',
        neededItemName: '',
        selectedMaps: [],
        selectedMods: [],
        minMapValue: 0,
      };
      const mockError = new Error('Database error');
      mockDB.all.mockRejectedValue(mockError);

      const result = await stats.getAllRunsForDates(params);

      expect(result).toEqual([]);
    });

    it('should handle null values in optional filters', async () => {
      const params = {
        from: '2023-01-01',
        to: '2023-01-31',
        neededItemName: '',
        selectedMaps: [],
        selectedMods: [],
        minMapValue: 0,
        iiq: undefined,
        iir: undefined,
        mapLevel: undefined,
        packSize: undefined,
        deaths: undefined,
      };
      mockDB.all.mockResolvedValue([]);

      const result = await stats.getAllRunsForDates(params);

      expect(result).toEqual([]);
    });

    it('should validate complex filtering query structure', async () => {
      const params = {
        from: '2023-01-01',
        to: '2023-01-31',
        neededItemName: 'Test Item',
        selectedMaps: ['Map1'],
        selectedMods: ['Mod1'],
        minMapValue: 100,
        iiq: { min: 70, max: 150 },
      };
      mockDB.all.mockResolvedValue([]);

      await stats.getAllRunsForDates(params);

      const calledQuery = mockDB.all.mock.calls[0][0];
      
      // Verify complex query structure
      expect(calledQuery).toContain('LEFT JOIN');
      expect(calledQuery).toContain('itemcount.run_id = run.id');
      expect(calledQuery).toContain('AND area_info.name IN (?)');
      expect(calledQuery).toContain('AND (run.iiq BETWEEN');
      expect(calledQuery).toContain('AND gained > ?');
      expect(calledQuery).toContain('ORDER BY run.id desc');
    });
  });

  describe('getAllItemsForRuns', () => {
    it('should return items for specific runs', async () => {
      const runs = [{ id: 1 }, { id: 2 }, { id: 3 }] as any[];
      const minLootValue = 50;
      const mockItems = [
        { map_id: 1, area: 'Test Map', id: 'item1', value: 100 },
        { map_id: 2, area: 'Another Map', id: 'item2', value: 200 },
      ];
      mockDB.all.mockResolvedValue(mockItems);

      const result = await stats.getAllItemsForRuns({ runs, minLootValue });

      expect(mockDB.all).toHaveBeenCalledWith(
        expect.stringContaining('AND run.id IN (1,2,3)'),
        [minLootValue]
      );
      expect(result).toEqual(mockItems);
    });

    it('should handle empty runs array', async () => {
      const runs: any[] = [];
      const minLootValue = 0;
      mockDB.all.mockResolvedValue([]);

      const result = await stats.getAllItemsForRuns({ runs, minLootValue });

      expect(mockDB.all).toHaveBeenCalledWith(
        expect.stringContaining('AND run.id IN ()'),
        [minLootValue]
      );
      expect(result).toEqual([]);
    });

    it('should return empty array when database query fails', async () => {
      const runs = [{ id: 1 }] as any[];
      const minLootValue = 50;
      const mockError = new Error('Database error');
      mockDB.all.mockRejectedValue(mockError);

      const result = await stats.getAllItemsForRuns({ runs, minLootValue });

      expect(result).toEqual([]);
    });
  });

  describe('getAllMapNames', () => {
    it('should return distinct map names', async () => {
      const mockMapNames = ['Tower Map', 'Cemetery Map', 'Glacier Map'];
      mockDB.all.mockResolvedValue(mockMapNames);

      const result = await stats.getAllMapNames();

      expect(mockDB.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT area_info.name')
      );
      expect(result).toEqual(mockMapNames);
    });

    it('should return empty array when no maps found', async () => {
      mockDB.all.mockResolvedValue(null);

      const result = await stats.getAllMapNames();

      expect(result).toEqual([]);
    });

    it('should return empty array when database query fails', async () => {
      const mockError = new Error('Database error');
      mockDB.all.mockRejectedValue(mockError);

      const result = await stats.getAllMapNames();

      expect(result).toEqual([]);
    });

    it('should validate map names query structure', async () => {
      mockDB.all.mockResolvedValue([]);

      await stats.getAllMapNames();

      const calledQuery = mockDB.all.mock.calls[0][0];
      
      expect(calledQuery).toContain('SELECT DISTINCT area_info.name');
      expect(calledQuery).toContain('FROM area_info, run');
      expect(calledQuery).toContain('WHERE run.id = area_info.run_id');
      expect(calledQuery).toContain("json_extract(run_info, '$.ignored') is null");
      expect(calledQuery).toContain('ORDER BY area_info.name asc');
    });
  });

  describe('getAllPossibleMods', () => {
    it('should return normalized mods using REGEXP_REPLACE', async () => {
      const mockMods = [
        'Increased Monster Life by #%',
        'Added Fire Damage',
        'Players take #% increased Damage',
      ];
      mockDB.all.mockResolvedValue(mockMods);

      const result = await stats.getAllPossibleMods();

      expect(mockDB.all).toHaveBeenCalledWith(
        expect.stringContaining("SELECT DISTINCT(REGEXP_REPLACE(mod, '\\d+', '#')) AS mod")
      );
      expect(result).toEqual(mockMods);
    });

    it('should return empty array when no mods found', async () => {
      mockDB.all.mockResolvedValue(null);

      const result = await stats.getAllPossibleMods();

      expect(result).toEqual([]);
    });

    it('should return empty array when database query fails', async () => {
      const mockError = new Error('Database error');
      mockDB.all.mockRejectedValue(mockError);

      const result = await stats.getAllPossibleMods();

      expect(result).toEqual([]);
    });

    it('should validate mods query uses REGEXP_REPLACE correctly', async () => {
      mockDB.all.mockResolvedValue([]);

      await stats.getAllPossibleMods();

      const calledQuery = mockDB.all.mock.calls[0][0];
      
      expect(calledQuery).toContain("REGEXP_REPLACE(mod, '\\d+', '#')");
      expect(calledQuery).toContain('FROM mapmod');
      expect(calledQuery).toContain('ORDER BY mod ASC');
    });
  });

  describe('getProfitPerHour', () => {
    it('should calculate profit per hour with default timeframe', async () => {
      const mockResult = {
        total_time_seconds: 3600, // 1 hour
        total_profit: 1000,
        runs: 5,
        items: 50,
      };
      mockDB.get.mockResolvedValue(mockResult);

      const result = await stats.getProfitPerHour();

      expect(mockDB.get).toHaveBeenCalledWith(
        expect.stringContaining('SUM(item.value) as total_profit'),
        ['20230101120000', '20230101120000']
      );
      expect(result).toBe(1000); // 1000 profit in 1 hour = 1000 per hour
    });

    it('should calculate profit per hour with custom timeframe', async () => {
      const customTime = '20230601120000';
      const mockResult = {
        total_time_seconds: 7200, // 2 hours
        total_profit: 2000,
        runs: 10,
        items: 100,
      };
      mockDB.get.mockResolvedValue(mockResult);

      const result = await stats.getProfitPerHour(customTime);

      expect(mockDB.get).toHaveBeenCalledWith(
        expect.any(String),
        [customTime, customTime]
      );
      expect(result).toBe(1000); // 2000 profit in 2 hours = 1000 per hour
    });

    it('should return 0 when no time tracked', async () => {
      const mockResult = {
        total_time_seconds: 0,
        total_profit: 1000,
        runs: 5,
        items: 50,
      };
      mockDB.get.mockResolvedValue(mockResult);

      const result = await stats.getProfitPerHour();

      expect(result).toBe(0);
    });

    it('should return 0 when database query fails', async () => {
      const mockError = new Error('Database error');
      mockDB.get.mockRejectedValue(mockError);

      const result = await stats.getProfitPerHour();

      expect(result).toBe(0);
    });

    it('should handle undefined result', async () => {
      mockDB.get.mockResolvedValue(undefined);

      const result = await stats.getProfitPerHour();

      expect(result).toBe(0);
    });

    it('should round result to 2 decimal places', async () => {
      const mockResult = {
        total_time_seconds: 3600,
        total_profit: 1234.5678,
        runs: 5,
        items: 50,
      };
      mockDB.get.mockResolvedValue(mockResult);

      const result = await stats.getProfitPerHour();

      expect(result).toBe(1234.57);
    });

    it('should validate profit calculation query structure', async () => {
      mockDB.get.mockResolvedValue({ total_time_seconds: 3600, total_profit: 1000 });

      await stats.getProfitPerHour();

      const calledQuery = mockDB.get.mock.calls[0][0];
      
      expect(calledQuery).toContain('SUM(item.value) as total_profit');
      expect(calledQuery).toContain('SUM(run.last_event - run.first_event)');
      expect(calledQuery).toContain('COUNT(DISTINCT item.id) AS items');
      expect(calledQuery).toContain('COUNT(DISTINCT run.id) AS runs');
      expect(calledQuery).toContain('JOIN item');
      expect(calledQuery).toContain('WHERE run.first_event > ?');
      expect(calledQuery).toContain('AND item.ignored = 0');
    });

    it('should use dayjs for default timeframe calculation', async () => {
      mockDB.get.mockResolvedValue({ total_time_seconds: 3600, total_profit: 1000 });

      await stats.getProfitPerHour();

      expect(mockDayjs).toHaveBeenCalled();
      expect(mockDayjs().subtract).toHaveBeenCalledWith(1, 'day');
      expect(mockDayjs().format).toHaveBeenCalledWith('YYYYMMDDHHmmss');
    });
  });
});


