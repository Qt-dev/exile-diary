import { EventEmitter } from 'events';

const callRuntimeMethod = jest.fn();
const getSettingsSnapshot = jest.fn();
const settingsEmitter = new EventEmitter();

jest.mock('../../../src/main/runtime/RuntimeSidecarClient', () => ({
  callRuntimeMethod: (...args: unknown[]) => callRuntimeMethod(...args),
  getSettingsSnapshot: (...args: unknown[]) => getSettingsSnapshot(...args),
  settingsEmitter,
  searchEmitter: new EventEmitter(),
  runTrackingEmitter: new EventEmitter(),
  killTrackerEmitter: new EventEmitter(),
  ratesEmitter: new EventEmitter(),
  clientLogsEmitter: new EventEmitter(),
  logIngestEmitter: new EventEmitter(),
  stashEmitter: new EventEmitter(),
  statsEmitter: new EventEmitter(),
  emitter: new EventEmitter(),
  start: jest.fn(),
  stop: jest.fn(),
  refreshHealth: jest.fn(),
  getHealth: jest.fn(),
  getLatestGeneratedArea: jest.fn(),
}));

jest.mock('../../../src/main/SettingsManager', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    getAll: jest.fn(() => ({})),
  },
}));

jest.mock('../../../src/main/modules/ImageParser/ScreenshotWatcher', () => ({
  __esModule: true,
  default: { emitter: new EventEmitter(), process: jest.fn() },
}));

jest.mock('../../../src/main/modules/ImageParser/OCRWatcher', () => ({
  emitter: new EventEmitter(),
  start: jest.fn(),
  stop: jest.fn(),
  refreshHealth: jest.fn(),
  getHealth: jest.fn(),
}));

describe('runtime sidecar settings bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSettingsSnapshot.mockReturnValue({});
    callRuntimeMethod.mockResolvedValue(undefined);
  });

  it('writes settings through the sidecar owner', async () => {
    const { createRuntimeSidecarBridge } = await import(
      '../../../src/main/runtime/createRuntimeSidecarBridge'
    );
    const bridge = createRuntimeSidecarBridge();

    await bridge.settings.set('mainWindowBounds', { width: 1200, height: 800 });

    expect(callRuntimeMethod).toHaveBeenCalledWith('settings.set', [
      'mainWindowBounds',
      { width: 1200, height: 800 },
    ]);
  });

  it('uses the sidecar save barrier before relaunch-sensitive work', async () => {
    const { createRuntimeSidecarBridge } = await import(
      '../../../src/main/runtime/createRuntimeSidecarBridge'
    );
    const bridge = createRuntimeSidecarBridge();

    await bridge.settings.waitForSave();

    expect(callRuntimeMethod).toHaveBeenCalledWith('settings.waitForSave');
  });
});
