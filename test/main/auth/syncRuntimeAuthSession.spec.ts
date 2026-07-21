const saveToken = jest.fn();
const logout = jest.fn();
const waitForSave = jest.fn();
const restart = jest.fn();
const reload = jest.fn();
const callRuntimeMethod = jest.fn();

jest.mock('../../../src/main/AuthManager', () => ({
  __esModule: true,
  default: {
    saveToken: (...args: unknown[]) => saveToken(...args),
    logout: (...args: unknown[]) => logout(...args),
  },
}));

jest.mock('../../../src/main/SettingsManager', () => ({
  __esModule: true,
  default: {
    waitForSave: (...args: unknown[]) => waitForSave(...args),
    reload: (...args: unknown[]) => reload(...args),
  },
}));

jest.mock('../../../src/main/runtime/RuntimeSidecarClient', () => ({
  restart: (...args: unknown[]) => restart(...args),
  callRuntimeMethod: (...args: unknown[]) => callRuntimeMethod(...args),
}));

describe('runtime auth session synchronization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    saveToken.mockResolvedValue(undefined);
    logout.mockResolvedValue(undefined);
    waitForSave.mockResolvedValue(undefined);
    restart.mockResolvedValue(undefined);
    reload.mockResolvedValue(undefined);
    callRuntimeMethod.mockResolvedValue(undefined);
  });

  it('persists new OAuth credentials before restarting the runtime sidecar', async () => {
    const { saveTokenAndSyncRuntime } = await import(
      '../../../src/main/auth/syncRuntimeAuthSession'
    );
    const token = {
      access_token: 'new-token',
      expires_in: 3600,
      username: 'AccountName',
    };

    await saveTokenAndSyncRuntime(token);

    expect(saveToken).toHaveBeenCalledWith(token);
    expect(callRuntimeMethod).toHaveBeenCalledWith('settings.waitForSave');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(waitForSave).toHaveBeenCalledTimes(1);
    expect(restart).toHaveBeenCalledTimes(1);
    expect(callRuntimeMethod.mock.invocationCallOrder[0]).toBeLessThan(
      reload.mock.invocationCallOrder[0]
    );
    expect(reload.mock.invocationCallOrder[0]).toBeLessThan(
      saveToken.mock.invocationCallOrder[0]
    );
    expect(saveToken.mock.invocationCallOrder[0]).toBeLessThan(
      waitForSave.mock.invocationCallOrder[0]
    );
    expect(waitForSave.mock.invocationCallOrder[0]).toBeLessThan(
      restart.mock.invocationCallOrder[0]
    );
  });

  it('clears main-process auth before restarting the runtime sidecar', async () => {
    const { logoutAndSyncRuntime } = await import(
      '../../../src/main/auth/syncRuntimeAuthSession'
    );

    await logoutAndSyncRuntime();

    expect(logout).toHaveBeenCalledTimes(1);
    expect(callRuntimeMethod).toHaveBeenCalledWith('settings.waitForSave');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(restart).toHaveBeenCalledTimes(1);
    expect(callRuntimeMethod.mock.invocationCallOrder[0]).toBeLessThan(
      reload.mock.invocationCallOrder[0]
    );
    expect(reload.mock.invocationCallOrder[0]).toBeLessThan(
      logout.mock.invocationCallOrder[0]
    );
    expect(logout.mock.invocationCallOrder[0]).toBeLessThan(restart.mock.invocationCallOrder[0]);
  });
});
