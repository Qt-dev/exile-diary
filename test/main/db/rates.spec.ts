jest.mock('../../../src/main/db/index', () => ({
  all: jest.fn(),
  run: jest.fn(),
}));

jest.mock('dayjs', () => {
  const mockDayjs = jest.fn(() => ({
    format: jest.fn().mockReturnValue('20230101'),
  }));
  return mockDayjs;
});

jest.mock('zlib', () => ({
  deflate: jest.fn(),
  inflate: jest.fn(),
}));

jest.mock('electron-log', () => ({
  scope: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  })),
}));

import rates from '../../../src/main/db/rates';
import DB from '../../../src/main/db/index';
import dayjs from 'dayjs';
import zlib from 'zlib';

const mockDB = DB as jest.Mocked<typeof DB>;
const mockDayjs = dayjs as jest.MockedFunction<typeof dayjs>;
const mockZlib = zlib as jest.Mocked<typeof zlib>;

describe('rates', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (mockDayjs as any).mockReturnValue({
      format: jest.fn().mockReturnValue('20230101'),
    });
  });

  describe('getFullRates', () => {
    it('returns inflated and parsed data for compressed rows', async () => {
      mockDB.all.mockResolvedValue([{ data: Buffer.from('compressed') }] as any);
      mockZlib.inflate.mockImplementation((data: any, cb: any) =>
        cb(null, Buffer.from(JSON.stringify({ divine: 180 })))
      );

      const result = await rates.getFullRates('Mercenaries', '2023-01-01');

      expect(mockDB.all).toHaveBeenCalledWith(
        'SELECT date, data FROM fullrates WHERE date <= ? OR date = (SELECT min(date) FROM fullrates) ORDER BY date DESC',
        ['20230101'],
        'Mercenaries'
      );
      expect(result).toEqual({ divine: 180 });
    });

    it('falls back to parsing uncompressed legacy data when inflate fails', async () => {
      mockDB.all.mockResolvedValue([{ data: JSON.stringify({ chaos: 1 }) }] as any);
      mockZlib.inflate.mockImplementation((data: any, cb: any) =>
        cb(new Error('not compressed'), null)
      );

      const result = await rates.getFullRates('Mercenaries', '2023-01-01');

      expect(result).toEqual({ chaos: 1 });
    });

    it('returns empty object when querying fails', async () => {
      mockDB.all.mockRejectedValue(new Error('query failed'));

      const result = await rates.getFullRates('Mercenaries', '2023-01-01');

      expect(result).toEqual({});
    });
  });

  describe('cleanRates', () => {
    it('runs delete statement for the provided date and league', async () => {
      mockDB.run.mockResolvedValue(undefined as any);

      await rates.cleanRates('Mercenaries', '20230101');

      expect(mockDB.run).toHaveBeenCalledWith('DELETE FROM fullrates WHERE date = ?', ['20230101'], 'Mercenaries');
    });

    it('swallows sync errors from DB.run', async () => {
      mockDB.run.mockImplementation(() => {
        throw new Error('run failed');
      });

      await expect(rates.cleanRates('Mercenaries', '20230101')).resolves.toBeUndefined();
    });
  });

  describe('insertRates', () => {
    it('deflates payload and inserts formatted data', async () => {
      const compressed = Buffer.from('compressed-bytes');
      mockZlib.deflate.mockImplementation((data: any, cb: any) => cb(null, compressed));
      mockDB.run.mockResolvedValue(undefined as any);

      const result = await rates.insertRates('Mercenaries', '2023-01-01', { divine: 200 });

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO fullrates (date, data) VALUES (?, ?)',
        ['20230101', compressed],
        'Mercenaries'
      );
      expect(result).toBe(true);
    });

    it('returns false when DB.run throws synchronously', async () => {
      mockZlib.deflate.mockImplementation((data: any, cb: any) => cb(null, Buffer.from('c')));
      mockDB.run.mockImplementation(() => {
        throw new Error('insert failed');
      });

      const result = await rates.insertRates('Mercenaries', '2023-01-01', { divine: 200 });

      expect(result).toBe(false);
    });

    it('rejects when deflate fails', async () => {
      mockZlib.deflate.mockImplementation((data: any, cb: any) =>
        cb(new Error('compression failed'), null)
      );

      await expect(rates.insertRates('Mercenaries', '2023-01-01', { divine: 200 })).rejects.toThrow(
        'compression failed'
      );
    });
  });

  describe('hasExistingRates', () => {
    it('returns true when count is greater than zero', async () => {
      mockDB.all.mockResolvedValue([{ count: 3 }] as any);

      const result = await rates.hasExistingRates('Mercenaries', '20230101');

      expect(mockDB.all).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM fullrates WHERE date = ?',
        ['20230101'],
        'Mercenaries'
      );
      expect(result).toBe(true);
    });

    it('returns false when count is zero', async () => {
      mockDB.all.mockResolvedValue([{ count: 0 }] as any);

      const result = await rates.hasExistingRates('Mercenaries', '20230101');

      expect(result).toBe(false);
    });

    it('returns false when query fails', async () => {
      mockDB.all.mockRejectedValue(new Error('query failed'));

      const result = await rates.hasExistingRates('Mercenaries', '20230101');

      expect(result).toBe(false);
    });
  });
});
