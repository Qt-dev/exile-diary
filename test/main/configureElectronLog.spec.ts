const mkdirSync = jest.fn();
const getUserDataPath = jest.fn(() => 'D:/Users/example/AppData/Roaming/exile-diary');

const logger = {
  transports: {
    file: {
      level: 'info' as string | false,
      resolvePathFn: undefined as undefined | (() => string),
    },
  },
};

jest.mock('fs', () => ({
  __esModule: true,
  default: {
    mkdirSync: (...args: unknown[]) => mkdirSync(...args),
  },
  mkdirSync: (...args: unknown[]) => mkdirSync(...args),
}));

jest.mock('electron-log', () => ({
  __esModule: true,
  default: logger,
}));

jest.mock('../../src/main/runtime/getUserDataPath', () => ({
  getUserDataPath: (...args: unknown[]) => getUserDataPath(...args),
}));

describe('configureElectronLog', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.EXILE_DIARY_DISABLE_FILE_LOGGING;
    logger.transports.file.level = 'info';
    logger.transports.file.resolvePathFn = undefined;
  });

  it('writes logs into the user data logs directory by default', async () => {
    const { configureElectronLog } = await import('../../src/main/configureElectronLog');

    configureElectronLog('main.log');

    expect(getUserDataPath).toHaveBeenCalledTimes(1);
    expect(mkdirSync).toHaveBeenCalledWith(
      '/D:/Users/example/AppData/Roaming/exile-diary/logs',
      { recursive: true }
    );
    expect(logger.transports.file.resolvePathFn?.()).toBe(
      '/D:/Users/example/AppData/Roaming/exile-diary/logs/main.log'
    );
  });

  it('disables file logging when the explicit env flag is set', async () => {
    process.env.EXILE_DIARY_DISABLE_FILE_LOGGING = '1';
    const { configureElectronLog } = await import('../../src/main/configureElectronLog');

    configureElectronLog('runtime-sidecar.log');

    expect(logger.transports.file.level).toBe(false);
    expect(getUserDataPath).not.toHaveBeenCalled();
    expect(mkdirSync).not.toHaveBeenCalled();
  });
});
