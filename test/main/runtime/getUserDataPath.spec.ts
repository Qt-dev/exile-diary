const mockGetPath = jest.fn();
let electronModuleUnavailable = false;

jest.mock('electron', () => {
  if (electronModuleUnavailable) {
    throw new Error('electron module unavailable');
  }

  return {
    app: {
      getPath: (...args: any[]) => mockGetPath(...args),
    },
  };
});

describe('getUserDataPath', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.EXILE_DIARY_USER_DATA_PATH;
    delete process.env.EXILE_DIARY_IS_PACKAGED;
    delete process.env.EXILE_DIARY_APP_VERSION;
    electronModuleUnavailable = false;
    mockGetPath.mockReturnValue('D:\\electron-user-data');
  });

  it('prefers the explicit environment override', () => {
    process.env.EXILE_DIARY_USER_DATA_PATH = '.tmp\\runtime-sidecar-user-data';
    const { getUserDataPath } = require('../../../src/main/runtime/getUserDataPath');

    expect(getUserDataPath()).toContain('.tmp');
    expect(getUserDataPath()).toContain('runtime-sidecar-user-data');
    expect(mockGetPath).not.toHaveBeenCalled();
  });

  it('does not load Electron when a sidecar environment override is available', () => {
    electronModuleUnavailable = true;
    process.env.EXILE_DIARY_USER_DATA_PATH = 'D:\\packaged-sidecar-user-data';
    const { getUserDataPath } = require('../../../src/main/runtime/getUserDataPath');

    expect(getUserDataPath()).toContain('packaged-sidecar-user-data');
  });

  it('falls back to the electron app userData path', () => {
    const { getUserDataPath } = require('../../../src/main/runtime/getUserDataPath');

    expect(getUserDataPath()).toBe('D:\\electron-user-data');
    expect(mockGetPath).toHaveBeenCalledWith('userData');
  });

  it('throws a helpful error when no userData path source exists', () => {
    mockGetPath.mockImplementation(() => {
      throw new Error('electron app unavailable');
    });
    const { getUserDataPath } = require('../../../src/main/runtime/getUserDataPath');

    expect(() => getUserDataPath()).toThrow(
      'Exile Diary user data path is unavailable. Set EXILE_DIARY_USER_DATA_PATH when running outside Electron.'
    );
  });

  it('prefers the explicit packaging override', () => {
    process.env.EXILE_DIARY_IS_PACKAGED = 'true';
    const { getIsPackaged } = require('../../../src/main/runtime/getUserDataPath');

    expect(getIsPackaged()).toBe(true);
  });

  it('falls back to the electron packaged flag', () => {
    const { getIsPackaged } = require('../../../src/main/runtime/getUserDataPath');

    expect(getIsPackaged()).toBe(false);
  });

  it('prefers the explicit app version override', () => {
    process.env.EXILE_DIARY_APP_VERSION = '9.9.9-sidecar';
    const { getAppVersion } = require('../../../src/main/runtime/getUserDataPath');

    expect(getAppVersion()).toBe('9.9.9-sidecar');
  });
});
