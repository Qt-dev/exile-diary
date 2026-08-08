import DB from '../index';
import type { RunStrategy, Strategy, StrategyInput } from '../../../shared/strategies';

const colorPattern = /^#[0-9a-f]{6}$/i;

function normalizeInput(input: StrategyInput): StrategyInput {
  const name = String(input?.name ?? '').trim();
  const description = String(input?.description ?? '').trim();
  const color = String(input?.color ?? '').trim();
  const costPerMap = Number(input?.costPerMap);

  if (!name) throw new Error('Strategy name is required');
  if (!colorPattern.test(color)) throw new Error('Strategy color must be a six-digit hex color');
  if (!Number.isFinite(costPerMap) || costPerMap < 0) {
    throw new Error('Strategy cost per map must be a non-negative number');
  }

  return { name, description, color: color.toUpperCase(), costPerMap };
}

const Strategies = {
  list: async (): Promise<Strategy[]> => {
    const rows = await DB.all(`
      SELECT strategy.id, strategy.name, strategy.description, strategy.color,
        strategy.cost_per_map AS costPerMap,
        COUNT(run_strategy.run_id) AS assignmentCount
      FROM strategy
      LEFT JOIN run_strategy ON run_strategy.strategy_id = strategy.id
      GROUP BY strategy.id
      ORDER BY strategy.name COLLATE NOCASE ASC
    `);
    return (rows ?? []) as Strategy[];
  },

  get: async (strategyId: number): Promise<Strategy | null> => {
    const row = await DB.get(
      `SELECT id, name, description, color, cost_per_map AS costPerMap
       FROM strategy WHERE id = ?`,
      [strategyId]
    );
    return (row as Strategy | undefined) ?? null;
  },

  create: async (input: StrategyInput): Promise<Strategy> => {
    const normalized = normalizeInput(input);
    try {
      const result = await DB.run(
        `INSERT INTO strategy(name, description, color, cost_per_map) VALUES(?, ?, ?, ?)`,
        [normalized.name, normalized.description, normalized.color, normalized.costPerMap]
      );
      const strategy = await Strategies.get(Number(result?.lastInsertRowid));
      if (!strategy) throw new Error('Strategy was not created');
      return strategy;
    } catch (error: any) {
      if (String(error?.message ?? '').includes('UNIQUE')) {
        throw new Error('A strategy with this name already exists');
      }
      throw error;
    }
  },

  update: async (strategyId: number, input: StrategyInput): Promise<Strategy> => {
    const normalized = normalizeInput(input);
    try {
      const result = await DB.run(
        `UPDATE strategy
         SET name = ?, description = ?, color = ?, cost_per_map = ?
         WHERE id = ?`,
        [
          normalized.name,
          normalized.description,
          normalized.color,
          normalized.costPerMap,
          strategyId,
        ]
      );
      if (!result?.changes) throw new Error('Strategy not found');
      const strategy = await Strategies.get(strategyId);
      if (!strategy) throw new Error('Strategy not found');
      return strategy;
    } catch (error: any) {
      if (String(error?.message ?? '').includes('UNIQUE')) {
        throw new Error('A strategy with this name already exists');
      }
      throw error;
    }
  },

  delete: async (strategyId: number): Promise<void> => {
    await DB.transactionSteps([
      { query: 'DELETE FROM run_strategy WHERE strategy_id = ?', params: [strategyId] },
      { query: 'DELETE FROM strategy WHERE id = ?', params: [strategyId] },
    ]);
  },

  getForRun: async (runId: number): Promise<RunStrategy[]> => {
    const rows = await DB.all(
      `SELECT strategy.id, strategy.name, strategy.color
       FROM strategy
       INNER JOIN run_strategy ON run_strategy.strategy_id = strategy.id
       WHERE run_strategy.run_id = ?
       ORDER BY strategy.name COLLATE NOCASE ASC`,
      [runId]
    );
    return (rows ?? []) as RunStrategy[];
  },

  setForRun: async (runId: number, strategyIds: number[]): Promise<RunStrategy[]> => {
    const run = await DB.get('SELECT id FROM run WHERE id = ?', [runId]);
    if (!run) throw new Error('Run not found');
    const ids = [...new Set(strategyIds.map(Number).filter(Number.isInteger))];
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const rows = await DB.all(`SELECT id FROM strategy WHERE id IN (${placeholders})`, ids);
      if ((rows ?? []).length !== ids.length)
        throw new Error('One or more strategies were not found');
    }

    const steps: Array<{ query: string; params?: any[] }> = [
      { query: 'DELETE FROM run_strategy WHERE run_id = ?', params: [runId] },
    ];
    for (const strategyId of ids) {
      steps.push({
        query: 'INSERT INTO run_strategy(run_id, strategy_id) VALUES(?, ?)',
        params: [runId, strategyId],
      });
    }
    await DB.transactionSteps(steps);
    return Strategies.getForRun(runId);
  },
};

export { normalizeInput };
export default Strategies;
