import path from 'path';

const mockAccess = jest.fn();
const mockWriteFile = jest.fn();
const mockRename = jest.fn();
const mockGetPath = jest.fn(() => '/mock-user-data');

const loggerScope = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
};

jest.mock('fs/promises', () => ({
  access: (...args: any[]) => mockAccess(...args),
  writeFile: (...args: any[]) => mockWriteFile(...args),
  rename: (...args: any[]) => mockRename(...args),
  constants: {
    F_OK: 0,
  },
}));

jest.mock('electron', () => ({
  app: {
    getPath: (...args: any[]) => mockGetPath(...args),
  },
}));

jest.mock('electron-log', () => ({
  scope: jest.fn(() => loggerScope),
}));

const settingsJsonPath = path.join('/mock-user-data', 'settings.json');
const tempSettingsJsonPath = path.join('/mock-user-data', 'settings.json.bak');

function loadSettingsModule(settingsData?: Record<string, any>) {
  jest.resetModules();
  if (settingsData) {
    jest.doMock(settingsJsonPath, () => settingsData, { virtual: true });
  } else {
    jest.doMock(
      settingsJsonPath,
      () => {
        throw new Error('module not found');
      },
      { virtual: true }
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../../src/main/db/settings');
}

describe('db/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccess.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
    mockGetPath.mockReturnValue('/mock-user-data');
  });

  describe('get', () => {
    it('returns parsed settings object when file can be required', () => {
      const mockSettings = { theme: 'dark', locale: 'en-US' };
      const settingsModule = loadSettingsModule(mockSettings);

      expect(settingsModule.get()).toEqual(mockSettings);
    });

    it('returns null when settings file cannot be loaded', () => {
      const settingsModule = loadSettingsModule();

      expect(settingsModule.get()).toBeNull();
      expect(loggerScope.error).toHaveBeenCalledTimes(2);
      expect(loggerScope.error).toHaveBeenCalledWith('Unable to load settings.json');
    });
  });

  describe('set', () => {
    it('writes updated settings through temp file then renames', async () => {
      const settingsModule = loadSettingsModule({ activeProfile: 'Alice' });

      await settingsModule.set('activeProfile', 'Bob');

      expect(mockAccess).toHaveBeenCalledWith(settingsJsonPath, 0);
      expect(mockWriteFile).toHaveBeenCalledWith(
        tempSettingsJsonPath,
        JSON.stringify({ activeProfile: 'Bob' })
      );
      expect(mockRename).toHaveBeenCalledWith(tempSettingsJsonPath, settingsJsonPath);
      expect(loggerScope.info).toHaveBeenCalledWith('Set "activeProfile" to "Bob"');
    });

    it('does not log info when key is mainWindowBounds', async () => {
      const settingsModule = loadSettingsModule({ mainWindowBounds: { width: 1000, height: 800 } });

      await settingsModule.set('mainWindowBounds', { width: 1400, height: 900 });

      expect(loggerScope.info).not.toHaveBeenCalled();
    });

    it('logs write errors and continues to rename', async () => {
      const settingsModule = loadSettingsModule({ foo: 1 });
      const writeError = new Error('write failed');
      mockWriteFile.mockRejectedValue(writeError);

      await settingsModule.set('foo', 2);

      expect(loggerScope.error).toHaveBeenCalledWith('Error writing temp settings file');
      expect(loggerScope.error).toHaveBeenCalledWith(writeError);
      expect(mockRename).toHaveBeenCalledWith(tempSettingsJsonPath, settingsJsonPath);
    });

    it('logs rename errors', async () => {
      const settingsModule = loadSettingsModule({ foo: 1 });
      const renameError = new Error('rename failed');
      mockRename.mockRejectedValue(renameError);

      await settingsModule.set('foo', 2);

      expect(loggerScope.error).toHaveBeenCalledWith('Error copying temp settings file');
      expect(loggerScope.error).toHaveBeenCalledWith(renameError);
    });

    it('rejects when settings file is not accessible', async () => {
      const settingsModule = loadSettingsModule({ foo: 1 });
      mockAccess.mockRejectedValue(new Error('not found'));

      await expect(settingsModule.set('foo', 2)).rejects.toThrow('not found');
    });
  });
});
