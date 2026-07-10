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
    expect(getCurrentCharacter).not.toHaveBeenCalled();
    expect(setProfileReady).toHaveBeenCalledWith(true);
    expect(SettingsManager.settings.activeProfile).toEqual({
      characterName: 'Alice',
      league: 'Settlers',
      valid: true,
    });
  });

  it('starts the rate refresh in the background after initializing the character database', async () => {
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

    expect(getAllCharacters).toHaveBeenCalledTimes(1);
    expect(SettingsManager.settings.activeProfile).toEqual({
      characterName: 'Alice',
      league: 'Settlers',
      valid: true,
    });
  });

  it('does not wait for DB initialization to finish before resolving activeProfile saves', async () => {
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
    expect(settled).toBe(true);
    expect(initDB).toHaveBeenCalledTimes(1);
    expect(initLeagueDB).toHaveBeenCalledTimes(0);

    resolveInitDB?.();
    resolveInitLeagueDB?.();
    await savePromise;

    expect(initLeagueDB).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rateGetterUpdate).toHaveBeenCalledTimes(1);
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
});
