import path from 'path';

const getAllCharacters = jest.fn();
const getCurrentCharacter = jest.fn();
const setProfileReady = jest.fn();
const rateGetterUpdate = jest.fn();
const initDB = jest.fn();
const initLeagueDB = jest.fn();
const mockAccess = jest.fn();
const mockWriteFile = jest.fn();
const mockRename = jest.fn();
const mockReadFile = jest.fn();
const mockGetPath = jest.fn(() => '/mock-user-data');

jest.mock('electron-log', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  stat: (...args: unknown[]) => mockAccess(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  rename: (...args: unknown[]) => mockRename(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

jest.mock('electron', () => ({
  ipcMain: {
    emit: jest.fn(),
  },
  app: {
    getPath: (...args: unknown[]) => mockGetPath(...args),
  },
}));

jest.mock('../../src/main/GGGAPI', () => ({
  __esModule: true,
  default: {
    getAllCharacters: (...args: unknown[]) => getAllCharacters(...args),
    getCurrentCharacter: (...args: unknown[]) => getCurrentCharacter(...args),
  },
}));

jest.mock('../../src/main/auth/AuthSessionReadiness', () => ({
  authSessionReadiness: {
    setProfileReady: (...args: unknown[]) => setProfileReady(...args),
  },
}));

jest.mock('../../src/main/db', () => ({
  __esModule: true,
  default: {
    initDB: (...args: unknown[]) => initDB(...args),
    initLeagueDB: (...args: unknown[]) => initLeagueDB(...args),
  },
}));

jest.mock('../../src/main/modules/RateGetterV2', () => ({
  __esModule: true,
  default: {
    update: (...args: unknown[]) => rateGetterUpdate(...args),
  },
}));

describe('SettingsManager character bootstrap', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockAccess.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue('{}');
    mockGetPath.mockReturnValue('/mock-user-data');
  });

  it('uses an explicitly requested character name without waiting on the current profile', async () => {
    getAllCharacters.mockResolvedValue([
      { name: 'Alice', league: 'Settlers' },
      { name: 'Bob', league: 'Hardcore Settlers' },
    ]);

    const SettingsManager = (await import('../../src/main/SettingsManager')).default as any;
    SettingsManager.settings = {
      activeProfile: null,
    };

    const character = await SettingsManager.getCharacter('Alice');

    expect(character).toEqual({ name: 'Alice', league: 'Settlers' });
    expect(getAllCharacters).toHaveBeenCalledTimes(1);
    expect(initDB).not.toHaveBeenCalled();
    expect(initLeagueDB).not.toHaveBeenCalled();
    expect(getCurrentCharacter).not.toHaveBeenCalled();
    expect(setProfileReady).toHaveBeenCalledWith(true);
    expect(SettingsManager.settings.activeProfile).toEqual({
      characterName: 'Alice',
      league: 'Settlers',
      valid: true,
    });
    await SettingsManager.save();
  });

  it('defers the rate refresh until the replacement runtime starts', async () => {
    getAllCharacters.mockResolvedValue([
      { name: 'Alice', league: 'Settlers' },
      { name: 'Bob', league: 'Hardcore Settlers' },
    ]);
    rateGetterUpdate.mockReturnValue(new Promise(() => {}));

    const SettingsManager = (await import('../../src/main/SettingsManager')).default as any;
    SettingsManager.settings = {
      activeProfile: null,
    };

    await expect(SettingsManager.set('activeProfile', {
      characterName: 'Alice',
      league: 'Settlers',
      valid: true,
    })).resolves.toBeUndefined();

    expect(getAllCharacters).not.toHaveBeenCalled();
    expect(initDB).toHaveBeenCalledWith('Alice', 'Settlers');
    expect(initLeagueDB).toHaveBeenCalledWith('Settlers', 'Alice');
    expect(SettingsManager.settings.activeProfile).toEqual({
      characterName: 'Alice',
      league: 'Settlers',
      valid: true,
    });
    expect(rateGetterUpdate).not.toHaveBeenCalled();
    await SettingsManager.save();
  });

  it('refreshes rates when the active runtime initializes an existing profile', async () => {
    rateGetterUpdate.mockResolvedValue(undefined);
    const SettingsManager = (await import('../../src/main/SettingsManager')).default as any;

    await SettingsManager.initializeDB({
      characterName: 'Alice',
      league: 'Settlers',
      valid: true,
    });

    expect(rateGetterUpdate).toHaveBeenCalledTimes(1);
  });

  it('waits for DB initialization before resolving activeProfile saves', async () => {
    getAllCharacters.mockResolvedValue([
      { name: 'Alice', league: 'Settlers' },
      { name: 'Bob', league: 'Hardcore Settlers' },
    ]);

    let resolveInitDB: (() => void) | undefined;
    let resolveInitLeagueDB: (() => void) | undefined;
    initDB.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveInitDB = resolve;
      })
    );
    initLeagueDB.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveInitLeagueDB = resolve;
      })
    );
    rateGetterUpdate.mockResolvedValue(undefined);

    const SettingsManager = (await import('../../src/main/SettingsManager')).default as any;
    SettingsManager.settings = {
      activeProfile: null,
    };

    const savePromise = SettingsManager.set('activeProfile', {
      characterName: 'Alice',
      league: 'Settlers',
      valid: true,
    });
    let settled = false;
    savePromise.then(() => {
      settled = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);
    expect(initDB).toHaveBeenCalledTimes(1);
    expect(initLeagueDB).toHaveBeenCalledTimes(0);

    resolveInitDB?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(initLeagueDB).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);
    resolveInitLeagueDB?.();
    await savePromise;

    expect(settled).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rateGetterUpdate).not.toHaveBeenCalled();
    await SettingsManager.save();
  });

  it('keeps the previous profile visible until the target database is ready', async () => {
    let resolveInitDB: (() => void) | undefined;
    initDB.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveInitDB = resolve;
      })
    );

    const SettingsManager = (await import('../../src/main/SettingsManager')).default as any;
    SettingsManager.settings = {
      activeProfile: { characterName: 'Old', league: 'Standard', valid: true },
    };

    const transition = SettingsManager.set('activeProfile', {
      characterName: 'Alice',
      league: 'Settlers',
      valid: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(SettingsManager.settings.activeProfile.characterName).toBe('Old');
    expect(setProfileReady).toHaveBeenLastCalledWith(false);

    resolveInitDB?.();
    await transition;
    expect(SettingsManager.settings.activeProfile.characterName).toBe('Alice');
    expect(setProfileReady).toHaveBeenLastCalledWith(true);
    await SettingsManager.save();
  });

  it('serializes concurrent profile transitions without rolling back a newer selection', async () => {
    const resolvers = new Map<string, () => void>();
    initDB.mockImplementation(
      (characterName: string) =>
        new Promise<void>((resolve) => {
          resolvers.set(characterName, resolve);
        })
    );

    const SettingsManager = (await import('../../src/main/SettingsManager')).default as any;
    SettingsManager.settings = {
      activeProfile: { characterName: 'Old', league: 'Standard', valid: true },
    };

    const first = SettingsManager.set('activeProfile', {
      characterName: 'Alice',
      league: 'Settlers',
      valid: true,
    });
    const second = SettingsManager.set('activeProfile', {
      characterName: 'Bob',
      league: 'Hardcore',
      valid: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(initDB).toHaveBeenCalledTimes(1);

    resolvers.get('Alice')?.();
    await first;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(initDB).toHaveBeenCalledTimes(2);
    expect(SettingsManager.settings.activeProfile.characterName).toBe('Alice');

    resolvers.get('Bob')?.();
    await second;
    expect(SettingsManager.settings.activeProfile.characterName).toBe('Bob');
    await SettingsManager.save();
  });

  it('does not reinitialize the database when the active profile identity is unchanged', async () => {
    const SettingsManager = (await import('../../src/main/SettingsManager')).default as any;
    SettingsManager.settings = {
      activeProfile: {
        characterName: 'Alice',
        league: 'Settlers',
        valid: true,
      },
    };

    await SettingsManager.set('activeProfile', {
      characterName: 'Alice',
      league: 'Settlers',
      valid: true,
      leagueOverride: 'Standard',
    });

    expect(initDB).not.toHaveBeenCalled();
    expect(initLeagueDB).not.toHaveBeenCalled();
    await SettingsManager.save();
  });

  it('writes through a process-specific temp file before replacing settings.json', async () => {
    const SettingsManager = (await import('../../src/main/SettingsManager')).default as any;
    SettingsManager.settings = {
      activeProfile: 'Alice',
    };

    await SettingsManager.save();

    const tempSettingsJsonPath = path.join(
      '/mock-user-data',
      `settings.${process.pid}.1.json.tmp`
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      tempSettingsJsonPath,
      JSON.stringify({ activeProfile: 'Alice' })
    );
    expect(mockRename).toHaveBeenCalledWith(
      tempSettingsJsonPath,
      path.join('/mock-user-data', 'settings.json')
    );
  });

  it('rejects save waiters when settings persistence fails', async () => {
    mockRename.mockRejectedValueOnce(new Error('rename failed'));
    const SettingsManager = (await import('../../src/main/SettingsManager')).default as any;
    SettingsManager.settings = { forceDebugMode: false };

    await SettingsManager.set('forceDebugMode', true);
    const waitForSave = SettingsManager.waitForSave();
    const save = SettingsManager.save();

    await expect(waitForSave).rejects.toThrow('rename failed');
    await expect(save).rejects.toThrow('rename failed');
  });

  it('reloads the latest persisted settings without scheduling a write', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ screenshots: { allowFolderWatch: true, screenshotDir: 'D:\\Shots' } })
    );
    const SettingsManager = (await import('../../src/main/SettingsManager')).default as any;

    await SettingsManager.reload();

    expect(SettingsManager.get('screenshots')).toEqual({
      allowFolderWatch: true,
      screenshotDir: 'D:\\Shots',
    });
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('does not schedule a no-op settings write during initialization', async () => {
    const SettingsManager = (await import('../../src/main/SettingsManager')).default as any;

    await SettingsManager.initialize();

    expect(SettingsManager.saveScheduler).toBeNull();
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockRename).not.toHaveBeenCalled();
  });

  it('forwards the actual previous value to setting listeners', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ forceDebugMode: false }));
    const SettingsManager = (await import('../../src/main/SettingsManager')).default as any;
    const listener = jest.fn();

    await SettingsManager.initialize();
    SettingsManager.registerListener('forceDebugMode', listener);
    await SettingsManager.set('forceDebugMode', true);

    expect(listener).toHaveBeenCalledWith(true, false);
    await SettingsManager.save();
  });
});
