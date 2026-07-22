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
  it('does not mistake an incomplete startup for a GPU failure', () => {
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

    expect(result.gpuSafeMode).toBe(false);
    expect(result.recoveryReason).toBe('previous-incomplete-startup');
    expect(appStub.commandLine.appendSwitch).not.toHaveBeenCalled();
  });

  it('does not persist an explicitly requested safe-mode startup', () => {
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
      preferGpuSafeMode: false,
      lastSuccessfulMode: 'gpu-safe',
    });
  });

  it('clears legacy safe-mode preferences that have no recorded GPU failure', () => {
    const fsStub = createFsStub({
      pendingLaunch: false,
      lastLaunchMode: 'gpu-safe',
      preferGpuSafeMode: true,
      lastRecoveryReason: 'previous-incomplete-startup',
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

    expect(manager.initialize().gpuSafeMode).toBe(false);
    expect(fsStub.readState()).toMatchObject({ preferGpuSafeMode: false });
    expect(appStub.commandLine.appendSwitch).not.toHaveBeenCalled();
  });

  it('retains safe mode after a confirmed GPU process failure', () => {
    const fsStub = createFsStub({
      pendingLaunch: false,
      lastLaunchMode: 'normal',
      preferGpuSafeMode: true,
      lastGpuFailureAt: '2026-07-06T00:30:00.000Z',
      lastGpuFailureReason: 'crashed',
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

    expect(manager.initialize()).toEqual({
      gpuSafeMode: true,
      recoveryReason: 'persisted-safe-mode',
    });
    expect(appStub.commandLine.appendSwitch).toHaveBeenCalledWith('use-angle', 'swiftshader');
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
