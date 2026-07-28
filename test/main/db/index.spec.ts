jest.mock('electron-log', () => ({
  scope: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  })),
}));

const fsMock = {
  existsSync: jest.fn(),
  copyFileSync: jest.fn(),
  renameSync: jest.fn(),
};

jest.mock('fs', () => ({
  __esModule: true,
  default: fsMock,
}));

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => 'D:\\mock-user-data'),
  },
}));

jest.mock('../../../src/main/db/sqlite-regex--cjs-fix', () => ({
  getLoadablePath: jest.fn(() => 'D:\\mock-ext\\regexp.dll'),
}));

const settingsGetMock = jest.fn();
jest.mock('../../../src/main/db/settings', () => ({
  get: settingsGetMock,
}));

const settingsManagerGetMock = jest.fn();
jest.mock('../../../src/main/SettingsManager', () => ({
  __esModule: true,
  default: {
    get: settingsManagerGetMock,
  },
}));

let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => {
    uuidCounter += 1;
    return `uuid-${uuidCounter}`;
  }),
}));

const dbConstructorMock = jest.fn((dbPath: string) => {
  const db = {
    name: dbPath,
    close: jest.fn(),
    loadExtension: jest.fn(),
    pragma: jest.fn(() => 0),
    prepare: jest.fn((sql: string) => {
      const statement = {
        all: jest.fn((params?: unknown[]) => ({ sql, params, method: 'all' })),
        get: jest.fn((params?: unknown[]) => ({ sql, params, method: 'get' })),
        run: jest.fn((params?: unknown[]) => ({ sql, params, method: 'run' })),
      };
      return statement;
    }),
    transaction: jest.fn((fn: (params: any[]) => void) => (params: any[]) => fn(params)),
  };

  return db;
});

jest.mock('better-sqlite3', () => ({
  __esModule: true,
  default: dbConstructorMock,
}));

function loadDbModule() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../../src/main/db/index').default;
}

function getFirstDbInstance() {
  const first = dbConstructorMock.mock.results[0];
  return first?.value;
}

describe('db/index', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    uuidCounter = 0;
    settingsGetMock.mockReset();
    settingsManagerGetMock.mockReset();
    settingsGetMock.mockReturnValue({
      activeProfile: {
        characterName: 'ActiveChar',
        league: 'Mercenaries',
      },
    });
    settingsManagerGetMock.mockReturnValue({
      characterName: 'ActiveChar',
    });
  });

  it('builds league db path from user data path', () => {
    const DB = loadDbModule();
    expect(DB.getLeagueDbPath('Standard')).toContain('mock-user-data');
    expect(DB.getLeagueDbPath('Standard')).toContain('Standard.leaguedb');
  });

  it('returns null for character path when active profile is unavailable', () => {
    settingsGetMock.mockReturnValue(null);
    const DB = loadDbModule();
    expect(DB.getCharacterDbPath()).toBeNull();
  });

  it('builds character db paths for old and new formats', () => {
    const DB = loadDbModule();
    expect(DB.getCharacterDbPath('Alice', 'Settlers')).toContain('Alice.Settlers.db');
    expect(DB.getCharacterDbPath('Alice', 'Settlers', true)).toContain('Alice.db');
  });

  it('uses active profile when character and league are omitted', () => {
    const DB = loadDbModule();
    expect(DB.getCharacterDbPath()).toContain('ActiveChar.Mercenaries.db');
  });

  it('returns null manager when no db path can be resolved', () => {
    settingsGetMock.mockReturnValue(null);
    const DB = loadDbModule();
    expect(DB.getManager()).toBeNull();
  });

  it('reuses manager instance for same resolved path', () => {
    const DB = loadDbModule();
    const manager1 = DB.getManager(undefined, 'ActiveChar');
    const manager2 = DB.getManager(undefined, 'ActiveChar');
    expect(manager1).toBe(manager2);
    expect(dbConstructorMock).toHaveBeenCalledTimes(1);
  });

  it('continues creating the db manager when the regex extension fails to load', () => {
    const DB = loadDbModule();
    dbConstructorMock.mockClear();
    const failingDb = {
      name: 'D:\\mock-user-data\\ActiveChar.Mercenaries.db',
      close: jest.fn(),
      loadExtension: jest.fn(() => {
        throw Object.assign(new Error('extension load failed'), { code: 'ERR_DLOPEN_FAILED' });
      }),
      pragma: jest.fn(() => 0),
      prepare: jest.fn((sql: string) => ({
        all: jest.fn((params?: unknown[]) => ({ sql, params, method: 'all' })),
        get: jest.fn((params?: unknown[]) => ({ sql, params, method: 'get' })),
        run: jest.fn((params?: unknown[]) => ({ sql, params, method: 'run' })),
      })),
      transaction: jest.fn((fn: (params: any[]) => void) => (params: any[]) => fn(params)),
    };
    dbConstructorMock.mockImplementationOnce(() => failingDb as any);

    const manager = DB.getManager(undefined, 'ActiveChar');

    expect(manager).toBeTruthy();
    expect(failingDb.loadExtension).toHaveBeenCalledTimes(1);
  });

  it('copies old character db naming pattern when needed', () => {
    fsMock.existsSync.mockImplementation((p: string) => p.endsWith('ActiveChar.db'));

    const DB = loadDbModule();
    DB.getManager(undefined, 'ActiveChar');

    const [oldPath, newPath] = fsMock.copyFileSync.mock.calls[0];
    expect(oldPath).toContain('ActiveChar.db');
    expect(newPath).toContain('ActiveChar.Mercenaries.db');
  });

  it('delegates all/get/run query methods to prepared statements', async () => {
    const DB = loadDbModule();
    const allResult = await DB.all('select 1 as x', [1]);
    const getResult = await DB.get('select 2 as y', [2]);
    const runResult = await DB.run('update test set x = ?', [3]);

    expect(allResult).toEqual({ sql: 'select 1 as x', params: [1], method: 'all' });
    expect(getResult).toEqual({ sql: 'select 2 as y', params: [2], method: 'get' });
    expect(runResult).toEqual({ sql: 'update test set x = ?', params: [3], method: 'run' });
  });

  it('executes transaction over every params entry', async () => {
    const DB = loadDbModule();
    const manager = DB.getManager(undefined, 'ActiveChar');
    await DB.transaction('insert into test values (?)', [[1], [2], [3]]);

    const statement = manager.db.prepare.mock.results.find(
      (_: unknown, idx: number) =>
        manager.db.prepare.mock.calls[idx][0] === 'insert into test values (?)'
    )?.value;
    expect(statement).toBeDefined();
    expect(statement!.run).toHaveBeenCalledTimes(3);
    expect(statement!.run).toHaveBeenNthCalledWith(1, [1]);
    expect(statement!.run).toHaveBeenNthCalledWith(2, [2]);
    expect(statement!.run).toHaveBeenNthCalledWith(3, [3]);
  });

  it('returns null from public query helpers when manager is unavailable', async () => {
    settingsGetMock.mockReturnValue(null);
    const DB = loadDbModule();
    await expect(DB.all('select 1')).resolves.toBeNull();
    await expect(DB.get('select 1')).resolves.toBeNull();
    await expect(DB.run('select 1')).resolves.toBeNull();
    await expect(DB.transaction('select 1', [])).resolves.toBeNull();
  });

  it('runs queued tasks in the same order they were submitted', async () => {
    const DB = loadDbModule();
    const seen: number[] = [];

    const manager = DB.getManager(undefined, 'ActiveChar');
    manager.db.prepare.mockImplementation((sql: string) => ({
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn((params: number[]) => {
        if (sql === 'insert into queue values (?)') {
          seen.push(params[0]);
        }
        return true;
      }),
    }));

    await Promise.all([
      DB.run('insert into queue values (?)', [1]),
      DB.run('insert into queue values (?)', [2]),
      DB.run('insert into queue values (?)', [3]),
    ]);

    expect(seen).toEqual([1, 2, 3]);
  });

  it('releases the task queue after a task throws', async () => {
    const DB = loadDbModule();
    const manager = DB.getManager(undefined, 'ActiveChar');

    await expect(
      manager.runTask(() => {
        throw new Error('query failed');
      })
    ).rejects.toThrow('query failed');
    await expect(manager.runTask(() => 42)).resolves.toBe(42);
  });

  it('initDB applies only missing migrations and maintenance', async () => {
    const DB = loadDbModule();
    const manager = DB.getManager(undefined, 'ActiveChar');
    manager.db.pragma.mockReturnValue(16);

    await DB.initDB('ActiveChar');

    const preparedSql = manager.db.prepare.mock.calls.map((call: [string]) => call[0]);
    expect(
      preparedSql.some((sql: string) => sql.includes('CREATE TABLE IF NOT EXISTS graftblood'))
    ).toBe(true);
    expect(
      preparedSql.some((sql: string) =>
        sql.includes('CREATE INDEX IF NOT EXISTS "graftblood_timestamp"')
      )
    ).toBe(true);
    expect(
      preparedSql.some((sql: string) => sql.includes('CREATE TABLE IF NOT EXISTS deferred_run'))
    ).toBe(true);
    expect(preparedSql.some((sql: string) => sql.includes('pragma user_version = 19'))).toBe(true);
    expect(preparedSql.some((sql: string) => sql.includes('delete from incubator'))).toBe(true);
    expect(manager.db.transaction).toHaveBeenCalled();
  });

  it('initDB rejects when the schema version cannot be read', async () => {
    const DB = loadDbModule();
    const manager = DB.getManager(undefined, 'ActiveChar');
    manager.db.pragma.mockImplementation(() => {
      throw new Error('pragma failed');
    });

    await expect(DB.initDB('ActiveChar')).rejects.toThrow('pragma failed');

    expect(manager.db.prepare).not.toHaveBeenCalled();
  });

  it('backs up and rebuilds an empty database after an interrupted migration', async () => {
    const DB = loadDbModule();
    const manager = DB.getManager(undefined, 'ActiveChar');
    manager.db.transaction.mockImplementationOnce(() => () => {
      throw new Error('interrupted migration');
    });
    jest.spyOn(manager, 'hasUserData').mockResolvedValue(false);
    fsMock.existsSync.mockReturnValue(true);

    await expect(DB.initDB('ActiveChar', 'Mercenaries')).resolves.toBeUndefined();

    expect(manager.db).not.toBe(getFirstDbInstance());
    expect(fsMock.renameSync).toHaveBeenCalledWith(
      expect.stringContaining('ActiveChar.Mercenaries.db'),
      expect.stringMatching(/ActiveChar\.Mercenaries\.db\.incomplete-\d+\.bak$/)
    );
  });

  it('backs up and rebuilds an empty current-version database with an invalid schema', async () => {
    const DB = loadDbModule();
    const manager = DB.getManager(undefined, 'ActiveChar');
    manager.db.pragma.mockReturnValue(18);
    manager.db.prepare.mockImplementation((sql: string) => ({
      all: jest.fn(),
      get: jest.fn(() => (sql.includes("name = ?") ? undefined : { sql })),
      run: jest.fn(),
    }));
    jest.spyOn(manager, 'hasUserData').mockResolvedValue(false);
    fsMock.existsSync.mockReturnValue(true);

    await expect(DB.initDB('ActiveChar', 'Mercenaries')).resolves.toBeUndefined();

    expect(manager.db).not.toBe(getFirstDbInstance());
    expect(fsMock.renameSync).toHaveBeenCalledWith(
      expect.stringContaining('ActiveChar.Mercenaries.db'),
      expect.stringMatching(/ActiveChar\.Mercenaries\.db\.incomplete-\d+\.bak$/)
    );
  });

  it('preserves and reports a failed database when it contains user data', async () => {
    const DB = loadDbModule();
    const manager = DB.getManager(undefined, 'ActiveChar');
    manager.db.transaction.mockImplementationOnce(() => () => {
      throw new Error('migration failed');
    });
    jest.spyOn(manager, 'hasUserData').mockResolvedValue(true);
    fsMock.existsSync.mockReturnValue(true);

    await expect(DB.initDB('ActiveChar', 'Mercenaries')).rejects.toThrow('migration failed');

    expect(fsMock.renameSync).not.toHaveBeenCalled();
  });

  it('initLeagueDB inserts active profile character when character name is not provided', async () => {
    const DB = loadDbModule();
    const leagueManager = DB.getManager('Mercenaries');
    leagueManager.db.pragma.mockReturnValue(1);

    await DB.initLeagueDB('Mercenaries', '');

    const preparedSql = leagueManager.db.prepare.mock.calls.map((call: [string]) => call[0]);
    expect(preparedSql).toContain('insert or ignore into characters values (?)');

    const statement = leagueManager.db.prepare.mock.results.find(
      (_: unknown, idx: number) =>
        leagueManager.db.prepare.mock.calls[idx][0] ===
        'insert or ignore into characters values (?)'
    )?.value;
    expect(statement).toBeDefined();
    expect(statement!.run).toHaveBeenCalledWith('ActiveChar');
  });

  it('initLeagueDB skips profile insertion when characterName is provided', async () => {
    const DB = loadDbModule();
    const leagueManager = DB.getManager('Mercenaries');
    leagueManager.db.pragma.mockReturnValue(1);

    await DB.initLeagueDB('Mercenaries', 'GivenChar');

    const preparedSql = leagueManager.db.prepare.mock.calls.map((call: [string]) => call[0]);
    expect(preparedSql).not.toContain('insert or ignore into characters values (?)');
  });

  it('initLeagueDB always re-applies league schema guards for partially initialized dbs', async () => {
    const DB = loadDbModule();
    const leagueManager = DB.getManager('Mercenaries');
    leagueManager.db.pragma.mockReturnValue(1);

    await DB.initLeagueDB('Mercenaries', 'GivenChar');

    const preparedSql = leagueManager.db.prepare.mock.calls.map((call: [string]) => call[0]);
    expect(
      preparedSql.filter((sql: string) => sql.includes('create table if not exists characters'))
        .length
    ).toBeGreaterThan(0);
    expect(
      preparedSql.filter((sql: string) => sql.includes('create table if not exists fullrates'))
        .length
    ).toBeGreaterThan(0);
    expect(
      preparedSql.filter((sql: string) => sql.includes('create table if not exists stashes')).length
    ).toBeGreaterThan(0);
  });

  it('loads sqlite regex extension when creating a manager', () => {
    const DB = loadDbModule();
    DB.getManager(undefined, 'ActiveChar');
    const db = getFirstDbInstance();
    expect(db.loadExtension).toHaveBeenCalledWith('D:\\mock-ext\\regexp.dll');
  });
});
