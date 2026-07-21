import { EventEmitter } from 'events';

const watch = jest.fn();

jest.mock('chokidar', () => ({
  __esModule: true,
  default: { watch: (...args: unknown[]) => watch(...args) },
}));

jest.mock('electron-log', () => ({
  scope: () => ({ info: jest.fn(), error: jest.fn() }),
}));

jest.mock('../../src/main/SettingsManager', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    getAll: jest.fn(() => ({})),
    set: jest.fn(),
    registerListener: jest.fn(),
  },
}));

jest.mock('../../src/main/modules/ImageParser/OCRWatcher', () => ({
  scanScreenshotBuffer: jest.fn(),
}));

function createWatcher() {
  const watcher = new EventEmitter() as EventEmitter & { close: jest.Mock };
  watcher.close = jest.fn();
  return watcher;
}

describe('ScreenshotWatcher settings ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reconfigures folder watching from sidecar-backed setting changes', async () => {
    const firstWatcher = createWatcher();
    const secondWatcher = createWatcher();
    watch.mockReturnValueOnce(firstWatcher).mockReturnValueOnce(secondWatcher);
    let settingsListener: ((value: any) => void) | undefined;
    const settingsSource = {
      get: jest.fn(),
      getAll: jest.fn(() => ({
        screenshots: {
          allowFolderWatch: true,
          screenshotDir: 'D:\\Screenshots\\One',
        },
      })),
      set: jest.fn(async () => undefined),
      registerListener: jest.fn((_key: string, listener: (value: any) => void) => {
        settingsListener = listener;
      }),
    };
    const { default: ScreenshotWatcher } = await import(
      '../../src/main/modules/ImageParser/ScreenshotWatcher'
    );

    ScreenshotWatcher.start(settingsSource);
    settingsListener?.({
      allowFolderWatch: true,
      screenshotDir: 'D:\\Screenshots\\Two',
    });

    expect(settingsSource.registerListener).toHaveBeenCalledWith(
      'screenshots',
      expect.any(Function)
    );
    expect(watch).toHaveBeenNthCalledWith(
      1,
      'D:\\Screenshots\\One',
      expect.any(Object)
    );
    expect(firstWatcher.close).toHaveBeenCalledTimes(1);
    expect(watch).toHaveBeenNthCalledWith(
      2,
      'D:\\Screenshots\\Two',
      expect.any(Object)
    );

    settingsListener?.({ allowFolderWatch: false, screenshotDir: 'disabled' });
    expect(secondWatcher.close).toHaveBeenCalledTimes(1);
  });
});
