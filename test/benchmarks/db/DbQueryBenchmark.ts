import { performance } from 'node:perf_hooks';

type BenchmarkCase = {
  name: string;
  run: () => void;
};

function timeCase(iterations: number, benchmarkCase: BenchmarkCase) {
  for (let i = 0; i < 20; i++) benchmarkCase.run();
  const started = performance.now();
  for (let i = 0; i < iterations; i++) benchmarkCase.run();
  const elapsedMs = performance.now() - started;
  return {
    name: benchmarkCase.name,
    totalMs: elapsedMs,
    avgMs: elapsedMs / iterations,
  };
}

function createDb() {
  let Database: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Database = require('better-sqlite3');
  } catch (error: any) {
    throw new Error(
      `Unable to load better-sqlite3 for benchmark execution. ${error?.message ?? error}\n` +
        'Run `npm rebuild better-sqlite3` (or reinstall dependencies with a matching Node version) and try again.'
    );
  }

  let db: any;
  try {
    db = new Database(':memory:');
  } catch (error: any) {
    throw new Error(
      `Unable to initialize better-sqlite3 in this runtime. ${error?.message ?? error}\n` +
        'Run `npm rebuild better-sqlite3` (or reinstall dependencies with a matching Node version) and try again.'
    );
  }
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE run (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_event TEXT NOT NULL,
      last_event TEXT NOT NULL
    );
    CREATE TABLE area_info (
      run_id INTEGER NOT NULL,
      name TEXT NOT NULL
    );
    CREATE TABLE event (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL
    );
    CREATE TABLE item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      value INTEGER NOT NULL,
      ignored INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE mapmod (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      mod TEXT NOT NULL
    );
    CREATE INDEX idx_item_id ON item(id);
    CREATE INDEX idx_item_event_ignored ON item(event_id, ignored);
    CREATE INDEX idx_event_timestamp ON event(timestamp);
    CREATE INDEX idx_area_run ON area_info(run_id);
  `);

  const insertRun = db.prepare('INSERT INTO run (first_event, last_event) VALUES (?, ?)');
  const insertArea = db.prepare('INSERT INTO area_info (run_id, name) VALUES (?, ?)');
  const insertEvent = db.prepare('INSERT INTO event (timestamp) VALUES (?)');
  const insertItem = db.prepare('INSERT INTO item (event_id, value, ignored) VALUES (?, ?, ?)');

  const seedTx = db.transaction(() => {
    for (let runId = 1; runId <= 500; runId++) {
      const first = `2026-01-${String((runId % 28) + 1).padStart(2, '0')} 10:00:00`;
      const last = `2026-01-${String((runId % 28) + 1).padStart(2, '0')} 10:20:00`;
      insertRun.run(first, last);
      insertArea.run(runId, `Map-${runId % 30}`);

      for (let eventOffset = 0; eventOffset < 20; eventOffset++) {
        const ts = `2026-01-${String((runId % 28) + 1).padStart(2, '0')} 10:${String(
          eventOffset
        ).padStart(2, '0')}:00`;
        const eventId = insertEvent.run(ts).lastInsertRowid as number;
        for (let itemOffset = 0; itemOffset < 5; itemOffset++) {
          insertItem.run(eventId, (itemOffset + 1) * 5, itemOffset % 9 === 0 ? 1 : 0);
        }
      }
    }
  });
  seedTx();

  return db;
}

function runBenchmarks() {
  const db = createDb();
  const iterations = 400;

  const itemIds = Array.from({ length: 150 }, (_, i) => String(i + 1));
  const oldMatchSql = `SELECT COUNT(1) AS count FROM item WHERE (${itemIds
    .map((id) => `(id = '${id}')`)
    .join(' OR ')})`;
  const newMatchSql = `SELECT COUNT(1) AS count FROM item WHERE id IN (${itemIds
    .map(() => '?')
    .join(', ')})`;
  const newMatchStmt = db.prepare(newMatchSql);

  const runIds = Array.from({ length: 120 }, (_, i) => i + 1);
  const oldRunsSql = `
    SELECT run.id AS map_id, area_info.name AS area, item.*
    FROM item, run, area_info, event
    WHERE item.value > ?
      AND item.event_id = event.id
      AND item.ignored = 0
      AND DATETIME(event.timestamp) BETWEEN DATETIME(run.first_event) AND DATETIME(run.last_event)
      AND map_id = area_info.run_id
      AND run.id IN (${runIds.join(',')})
  `;
  const newRunsSql = `
    SELECT run.id AS map_id, area_info.name AS area, item.*
    FROM item, run, area_info, event
    WHERE item.value > ?
      AND item.event_id = event.id
      AND item.ignored = 0
      AND DATETIME(event.timestamp) BETWEEN DATETIME(run.first_event) AND DATETIME(run.last_event)
      AND map_id = area_info.run_id
      AND run.id IN (${runIds.map(() => '?').join(',')})
  `;
  const newRunsStmt = db.prepare(newRunsSql);

  const simpleSql = 'SELECT value FROM item WHERE id = ?';
  const cachedSimpleStmt = db.prepare(simpleSql);

  const mods = Array.from({ length: 80 }, (_, i) => `mod-${i}`);
  const insertModSql = 'INSERT INTO mapmod(run_id, mod) VALUES(?, ?)';
  const oldInsertStmt = db.prepare(insertModSql);
  const txInsertStmt = db.prepare(insertModSql);
  const txInsert = db.transaction((rows: string[]) => {
    for (const mod of rows) {
      txInsertStmt.run(999, mod);
    }
  });

  const cases: BenchmarkCase[] = [
    {
      name: 'items.getMatchingItemsCount old OR-chain',
      run: () => {
        db.prepare(oldMatchSql).get();
      },
    },
    {
      name: 'items.getMatchingItemsCount new IN placeholders',
      run: () => {
        newMatchStmt.get(...itemIds);
      },
    },
    {
      name: 'stats.getAllItemsForRuns old inline IN ids',
      run: () => {
        db.prepare(oldRunsSql).all(0);
      },
    },
    {
      name: 'stats.getAllItemsForRuns new parameterized IN ids',
      run: () => {
        newRunsStmt.all(0, ...runIds);
      },
    },
    {
      name: 'db/index old prepare every call',
      run: () => {
        for (let i = 1; i <= 120; i++) {
          db.prepare(simpleSql).get(i);
        }
      },
    },
    {
      name: 'db/index new cached prepared statement',
      run: () => {
        for (let i = 1; i <= 120; i++) {
          cachedSimpleStmt.get(i);
        }
      },
    },
    {
      name: 'run.insertMapMods old per-call write',
      run: () => {
        db.exec('DELETE FROM mapmod WHERE run_id = 999');
        for (const mod of mods) {
          oldInsertStmt.run(999, mod);
        }
      },
    },
    {
      name: 'run.insertMapMods new transaction batch',
      run: () => {
        db.exec('DELETE FROM mapmod WHERE run_id = 999');
        txInsert(mods);
      },
    },
  ];

  console.log('DB Query Benchmark');
  console.log('Iterations per case:', iterations);
  for (const benchmarkCase of cases) {
    const result = timeCase(iterations, benchmarkCase);
    console.log(
      `${result.name}: total=${result.totalMs.toFixed(2)}ms avg=${result.avgMs.toFixed(4)}ms`
    );
  }

  db.close();
}

runBenchmarks();
