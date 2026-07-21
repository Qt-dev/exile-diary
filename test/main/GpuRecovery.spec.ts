import { createGpuRecoveryManager, GPU_SAFE_MODE_ARG } from '../../src/main/GpuRecovery';

function createFsStub(initialState?: Record<string, any>) {
  let fileState = initialState ? JSON.stringify(initialState) : null;

  return {
    existsSync: jest.fn(() => fileState !== null),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn(() => fileState ?? ''),
    writeFileSync: jest.fn((_: string, value: string) => {
      fileState = value;
    }),
    readState: () => (fileState ? JSON.parse(fileState) : null),
  };
}

function createAppStub() {
  return {
    disableHardwareAcceleration: jest.fn(),
    commandLine: {
      appendSwitch: jest.fn(),
    },
  };
}

describe('GpuRecovery', () => {
  it('enables safe mode after a previous incomplete startup', () => {
    const fsStub = createFsStub({
      pendingLaunch: true,
      startedAt: '2026-07-06T00:00:00.000Z',
      lastLaunchMode: 'normal',
    });
    const appStub = createAppStub();
    const manager = createGpuRecoveryManager({
      appLike: appStub,
      argv: ['electron', '.'],
      env: {},
      fsLike: fsStub,
      now: () => '2026-07-06T01:00:00.000Z',
      userDataPath: '/mock/userdata',
    });

    const result = manager.initialize();

    expect(result.gpuSafeMode).toBe(true);
    expect(result.recoveryReason).toBe('previous-incomplete-startup');
    expect(appStub.commandLine.appendSwitch).toHaveBeenCalledWith('use-angle', 'swiftshader');
    expect(appStub.commandLine.appendSwitch).toHaveBeenCalledWith('ignore-gpu-blocklist');
  });

  it('persists safe mode after a successful safe-mode startup', () => {
    const fsStub = createFsStub({
      pendingLaunch: true,
      startedAt: '2026-07-06T00:00:00.000Z',
      lastLaunchMode: 'normal',
    });
    const appStub = createAppStub();
    const manager = createGpuRecoveryManager({
      appLike: appStub,
      argv: ['electron', '.', GPU_SAFE_MODE_ARG],
      env: {},
      fsLike: fsStub,
      now: () => '2026-07-06T01:00:00.000Z',
      userDataPath: '/mock/userdata',
    });

    manager.initialize();
    manager.markStartupSuccessful();

    expect(fsStub.readState()).toMatchObject({
      pendingLaunch: false,
      preferGpuSafeMode: true,
      lastSuccessfulMode: 'gpu-safe',
    });
  });

  it('requests a relaunch after repeated GPU process crashes during startup', () => {
    const fsStub = createFsStub();
    const appStub = createAppStub();
    const manager = createGpuRecoveryManager({
      appLike: appStub,
      argv: ['electron', '.', '--some-flag'],
      env: {},
      fsLike: fsStub,
      now: () => '2026-07-06T01:00:00.000Z',
      userDataPath: '/mock/userdata',
    });

    manager.initialize();

    expect(manager.handleGpuProcessGone({ type: 'GPU', reason: 'crashed' })).toBe(false);
    expect(manager.handleGpuProcessGone({ type: 'GPU', reason: 'crashed' })).toBe(false);
    expect(manager.handleGpuProcessGone({ type: 'GPU', reason: 'crashed' })).toBe(true);
    expect(manager.getRelaunchArgs()).toEqual(['.', '--some-flag', GPU_SAFE_MODE_ARG]);
    expect(fsStub.readState()).toMatchObject({
      preferGpuSafeMode: true,
      gpuFailureCount: 3,
      lastGpuFailureReason: 'crashed',
    });
  });
});
