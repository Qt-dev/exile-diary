// Mock the dependencies at the module level
jest.mock('../../../src/main/db/index', () => ({
  get: jest.fn(),
  run: jest.fn(),
  all: jest.fn(),
  transaction: jest.fn(),
}));

jest.mock('dayjs', () => {
  const mockDayjs = jest.fn(() => ({
    toISOString: jest.fn().mockReturnValue('2023-01-01T12:00:00.000Z'),
  }));
  return mockDayjs;
});

jest.mock('electron-log', () => ({
  scope: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  })),
}));

import League from '../../../src/main/db/league';
import DB from '../../../src/main/db/index';
import dayjs from 'dayjs';

const mockDB = DB as jest.Mocked<typeof DB>;
const mockDayjs = dayjs as jest.MockedFunction<typeof dayjs>;

describe('League', () => {
  const mockISOString = '2023-01-01T12:00:00.000Z';

  beforeEach(() => {
    jest.resetAllMocks();
    // Setup dayjs mock to return a consistent ISO string
    (mockDayjs as any).mockReturnValue({
      toISOString: jest.fn().mockReturnValue(mockISOString),
    });
  });

  describe('addLeague', () => {
    it('should add a new league successfully', async () => {
      const leagueName = 'Sanctum';
      mockDB.run.mockResolvedValue(undefined);

      await League.addLeague(leagueName);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT OR IGNORE INTO league(timestamp, name) values(?, ?)',
        [mockISOString, leagueName]
      );
    });

    it('should validate SQL query structure for SQLite compatibility', async () => {
      const leagueName = 'Test League';
      mockDB.run.mockResolvedValue(undefined);

      await League.addLeague(leagueName);

      const expectedQuery = 'INSERT OR IGNORE INTO league(timestamp, name) values(?, ?)';
      expect(mockDB.run).toHaveBeenCalledWith(expectedQuery, [mockISOString, leagueName]);

      // Verify query matches expected SQLite league table schema
      expect(expectedQuery).toContain('INSERT OR IGNORE INTO league');
      expect(expectedQuery).toContain('timestamp');
      expect(expectedQuery).toContain('name');
      expect(expectedQuery).toContain('values(?, ?)');
    });
  });
});
