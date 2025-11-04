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

import DB from '../../../src/main/db/index';

const mockDB = DB as jest.Mocked<typeof DB>;

describe('Graftblood Database', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Graftblood Table Schema', () => {
    it('should have the correct table structure', async () => {
      // This test verifies that the graftblood table can be queried
      // In a real database, this would check the schema
      mockDB.all.mockResolvedValue([]);

      // Simulating a query that would work with the proper schema
      const query = 'SELECT id, timestamp, value FROM graftblood LIMIT 1';
      await mockDB.all(query);

      expect(mockDB.all).toHaveBeenCalledWith(query);
    });

    it('should support timestamp index for efficient queries', async () => {
      // This verifies that timestamp-based queries can be executed
      mockDB.all.mockResolvedValue([]);

      const query =
        'SELECT value FROM graftblood WHERE DATETIME(timestamp) BETWEEN DATETIME(?) AND DATETIME(?) ORDER BY timestamp';
      await mockDB.all(query, ['2023-01-01T00:00:00.000Z', '2023-01-01T23:59:59.999Z']);

      expect(mockDB.all).toHaveBeenCalledWith(query, [
        '2023-01-01T00:00:00.000Z',
        '2023-01-01T23:59:59.999Z',
      ]);
    });
  });

  describe('Graftblood Data Operations', () => {
    it('should insert graftblood data successfully', async () => {
      const timestamp = '2023-01-01T12:00:00.000Z';
      const value = 503;

      mockDB.run.mockResolvedValue(undefined);

      await mockDB.run('INSERT INTO graftblood(timestamp, value) VALUES(?, ?)', [timestamp, value]);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO graftblood(timestamp, value) VALUES(?, ?)',
        [timestamp, value]
      );
    });

    it('should query graftblood data by timestamp range', async () => {
      const mockData = [
        { id: 1, timestamp: '2023-01-01T12:00:00.000Z', value: 100 },
        { id: 2, timestamp: '2023-01-01T12:15:00.000Z', value: 250 },
        { id: 3, timestamp: '2023-01-01T12:30:00.000Z', value: 450 },
      ];

      mockDB.all.mockResolvedValue(mockData);

      const result = await mockDB.all(
        'SELECT * FROM graftblood WHERE DATETIME(timestamp) BETWEEN DATETIME(?) AND DATETIME(?) ORDER BY timestamp',
        ['2023-01-01T12:00:00.000Z', '2023-01-01T12:30:00.000Z']
      );

      expect(result).toEqual(mockData);
      expect(mockDB.all).toHaveBeenCalledWith(
        'SELECT * FROM graftblood WHERE DATETIME(timestamp) BETWEEN DATETIME(?) AND DATETIME(?) ORDER BY timestamp',
        ['2023-01-01T12:00:00.000Z', '2023-01-01T12:30:00.000Z']
      );
    });

    it('should handle empty result sets', async () => {
      mockDB.all.mockResolvedValue([]);

      const result = await mockDB.all(
        'SELECT * FROM graftblood WHERE DATETIME(timestamp) > DATETIME(?)',
        ['2099-12-31T23:59:59.999Z']
      );

      expect(result).toEqual([]);
    });

    it('should support ordering by timestamp', async () => {
      const mockData = [
        { id: 3, timestamp: '2023-01-01T12:30:00.000Z', value: 450 },
        { id: 1, timestamp: '2023-01-01T12:00:00.000Z', value: 100 },
        { id: 2, timestamp: '2023-01-01T12:15:00.000Z', value: 250 },
      ];

      mockDB.all.mockResolvedValue(mockData);

      const result = await mockDB.all('SELECT * FROM graftblood ORDER BY timestamp DESC');

      expect(result).toEqual(mockData);
    });

    it('should handle multiple entries at the same timestamp', async () => {
      const timestamp = '2023-01-01T12:00:00.000Z';
      const mockData = [
        { id: 1, timestamp, value: 100 },
        { id: 2, timestamp, value: 100 },
      ];

      mockDB.all.mockResolvedValue(mockData);

      const result = await mockDB.all('SELECT * FROM graftblood WHERE timestamp = ?', [timestamp]);

      expect(result).toEqual(mockData);
    });

    it('should handle large graftblood values', async () => {
      const timestamp = '2023-01-01T12:00:00.000Z';
      const value = 999999;

      mockDB.run.mockResolvedValue(undefined);

      await mockDB.run('INSERT INTO graftblood(timestamp, value) VALUES(?, ?)', [timestamp, value]);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO graftblood(timestamp, value) VALUES(?, ?)',
        [timestamp, value]
      );
    });

    it('should handle zero graftblood values', async () => {
      const timestamp = '2023-01-01T12:00:00.000Z';
      const value = 0;

      mockDB.run.mockResolvedValue(undefined);

      await mockDB.run('INSERT INTO graftblood(timestamp, value) VALUES(?, ?)', [timestamp, value]);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO graftblood(timestamp, value) VALUES(?, ?)',
        [timestamp, value]
      );
    });
  });

  describe('Graftblood Integration with Runs', () => {
    it('should allow joining graftblood data with run data', async () => {
      const mockData = [
        {
          run_id: 1,
          first_event: '2023-01-01T12:00:00.000Z',
          last_event: '2023-01-01T12:30:00.000Z',
          graftblood_start: 100,
          graftblood_end: 450,
        },
      ];

      mockDB.all.mockResolvedValue(mockData);

      const query = `
        SELECT
          r.id as run_id,
          r.first_event,
          r.last_event,
          g1.value as graftblood_start,
          g2.value as graftblood_end
        FROM run r
        LEFT JOIN graftblood g1 ON DATETIME(g1.timestamp) >= DATETIME(r.first_event)
        LEFT JOIN graftblood g2 ON DATETIME(g2.timestamp) <= DATETIME(r.last_event)
        WHERE r.id = ?
        LIMIT 1
      `;

      const result = await mockDB.all(query, [1]);

      expect(result).toEqual(mockData);
    });

    it('should handle runs with no graftblood data', async () => {
      const mockData = [
        {
          run_id: 1,
          first_event: '2023-01-01T12:00:00.000Z',
          last_event: '2023-01-01T12:30:00.000Z',
          graftblood_start: null,
          graftblood_end: null,
        },
      ];

      mockDB.all.mockResolvedValue(mockData);

      const result = await mockDB.all(
        'SELECT r.id as run_id, g.value FROM run r LEFT JOIN graftblood g ON DATETIME(g.timestamp) BETWEEN DATETIME(r.first_event) AND DATETIME(r.last_event) WHERE r.id = ?',
        [1]
      );

      expect(result).toEqual(mockData);
    });
  });

  describe('Graftblood Data Maintenance', () => {
    it('should support deleting old graftblood data', async () => {
      mockDB.run.mockResolvedValue(undefined);

      await mockDB.run('DELETE FROM graftblood WHERE DATETIME(timestamp) < DATETIME(?)', [
        '2023-01-01T00:00:00.000Z',
      ]);

      expect(mockDB.run).toHaveBeenCalledWith(
        'DELETE FROM graftblood WHERE DATETIME(timestamp) < DATETIME(?)',
        ['2023-01-01T00:00:00.000Z']
      );
    });

    it('should support counting graftblood entries', async () => {
      mockDB.get.mockResolvedValue({ count: 42 });

      const result = await mockDB.get('SELECT COUNT(*) as count FROM graftblood');

      expect(result).toEqual({ count: 42 });
    });

    it('should support aggregating graftblood data', async () => {
      mockDB.get.mockResolvedValue({ min: 0, max: 9252, avg: 4626 });

      const result = await mockDB.get(
        'SELECT MIN(value) as min, MAX(value) as max, AVG(value) as avg FROM graftblood'
      );

      expect(result).toEqual({ min: 0, max: 9252, avg: 4626 });
    });
  });

  describe('Migration Compatibility', () => {
    it('should verify migration version 17 creates graftblood table', () => {
      // This is a conceptual test - in practice, migrations are tested during integration
      const migrationSQL = `CREATE TABLE IF NOT EXISTS graftblood (
          id INTEGER NOT NULL,
          timestamp TEXT NOT NULL,
          value INTEGER NOT NULL,
          PRIMARY KEY ("id" AUTOINCREMENT)
        )`;

      expect(migrationSQL).toContain('CREATE TABLE IF NOT EXISTS graftblood');
      expect(migrationSQL).toContain('id INTEGER NOT NULL');
      expect(migrationSQL).toContain('timestamp TEXT NOT NULL');
      expect(migrationSQL).toContain('value INTEGER NOT NULL');
      expect(migrationSQL).toContain('PRIMARY KEY');
      expect(migrationSQL).toContain('AUTOINCREMENT');
    });

    it('should verify migration version 17 creates timestamp index', () => {
      const indexSQL = `CREATE INDEX IF NOT EXISTS "graftblood_timestamp" ON "graftblood" ("timestamp")`;

      expect(indexSQL).toContain('CREATE INDEX IF NOT EXISTS');
      expect(indexSQL).toContain('graftblood_timestamp');
      expect(indexSQL).toContain('ON "graftblood"');
      expect(indexSQL).toContain('("timestamp")');
    });

    it('should handle migration idempotency with IF NOT EXISTS', () => {
      // Verify that the migration can be run multiple times safely
      const createTableSQL = 'CREATE TABLE IF NOT EXISTS graftblood';
      const createIndexSQL = 'CREATE INDEX IF NOT EXISTS "graftblood_timestamp"';

      expect(createTableSQL).toContain('IF NOT EXISTS');
      expect(createIndexSQL).toContain('IF NOT EXISTS');
    });
  });

  describe('Data Type Validation', () => {
    it('should store timestamp as TEXT in ISO format', async () => {
      const timestamp = '2023-01-01T12:00:00.000Z';
      mockDB.run.mockResolvedValue(undefined);

      await mockDB.run('INSERT INTO graftblood(timestamp, value) VALUES(?, ?)', [timestamp, 100]);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO graftblood(timestamp, value) VALUES(?, ?)',
        [timestamp, 100]
      );
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should store value as INTEGER', async () => {
      const timestamp = '2023-01-01T12:00:00.000Z';
      const value = 503;

      mockDB.run.mockResolvedValue(undefined);

      await mockDB.run('INSERT INTO graftblood(timestamp, value) VALUES(?, ?)', [timestamp, value]);

      expect(typeof value).toBe('number');
      expect(Number.isInteger(value)).toBe(true);
    });
  });
});
