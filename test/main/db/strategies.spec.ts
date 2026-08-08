jest.mock('../../../src/main/db/index', () => ({
  all: jest.fn(),
  get: jest.fn(),
  run: jest.fn(),
  transactionSteps: jest.fn(),
}));

import Strategies from '../../../src/main/db/repositories/strategies';
import DB from '../../../src/main/db/index';

const mockDB = DB as jest.Mocked<typeof DB>;

describe('strategy repository', () => {
  beforeEach(() => jest.resetAllMocks());

  it('normalizes and creates a strategy', async () => {
    mockDB.run.mockResolvedValue({ lastInsertRowid: 7 } as any);
    mockDB.get.mockResolvedValue({
      id: 7,
      name: 'Atlas',
      description: 'Red maps',
      color: '#AABBCC',
      costPerMap: 12.5,
    });

    await expect(
      Strategies.create({
        name: ' Atlas ',
        description: ' Red maps ',
        color: '#aabbcc',
        costPerMap: 12.5,
      })
    ).resolves.toMatchObject({ id: 7, name: 'Atlas', color: '#AABBCC' });
    expect(mockDB.run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO strategy'), [
      'Atlas',
      'Red maps',
      '#AABBCC',
      12.5,
    ]);
  });

  it('replaces all run assignments atomically', async () => {
    mockDB.get.mockResolvedValueOnce({ id: 42 }).mockResolvedValueOnce(undefined);
    mockDB.all.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]).mockResolvedValueOnce([]);
    mockDB.transactionSteps.mockResolvedValue(undefined as any);
    await expect(Strategies.setForRun(42, [1, 2, 2])).resolves.toEqual([]);
    expect(mockDB.transactionSteps).toHaveBeenCalledWith([
      { query: 'DELETE FROM run_strategy WHERE run_id = ?', params: [42] },
      { query: 'INSERT INTO run_strategy(run_id, strategy_id) VALUES(?, ?)', params: [42, 1] },
      { query: 'INSERT INTO run_strategy(run_id, strategy_id) VALUES(?, ?)', params: [42, 2] },
    ]);
  });

  it('rejects invalid definitions', async () => {
    await expect(
      Strategies.create({ name: '', description: 'x', color: '#fff', costPerMap: 0 })
    ).rejects.toThrow('Strategy name is required');
    await expect(
      Strategies.create({ name: 'x', description: 'x', color: '#ffffff', costPerMap: -1 })
    ).rejects.toThrow('non-negative');
  });

  it('allows an empty description', async () => {
    mockDB.run.mockResolvedValue({ lastInsertRowid: 8 } as any);
    mockDB.get.mockResolvedValue({
      id: 8,
      name: 'Atlas',
      description: '',
      color: '#AABBCC',
      costPerMap: 0,
    });

    await expect(
      Strategies.create({ name: 'Atlas', description: '', color: '#aabbcc', costPerMap: 0 })
    ).resolves.toMatchObject({ id: 8, description: '' });
  });
});
