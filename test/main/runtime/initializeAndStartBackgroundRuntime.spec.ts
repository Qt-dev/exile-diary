import { initializeAndStartBackgroundRuntime } from '../../../src/main/runtime/initializeAndStartBackgroundRuntime';

describe('initializeAndStartBackgroundRuntime', () => {
  it('waits for runtime initialization before starting background services', async () => {
    let finishInitialization: (() => void) | undefined;
    const ensureRuntimeStateInitialized = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishInitialization = resolve;
        })
    );
    const startBackgroundRuntime = jest.fn(async () => undefined);

    const startup = initializeAndStartBackgroundRuntime(
      ensureRuntimeStateInitialized,
      startBackgroundRuntime
    );
    await Promise.resolve();

    expect(ensureRuntimeStateInitialized).toHaveBeenCalledTimes(1);
    expect(startBackgroundRuntime).not.toHaveBeenCalled();

    finishInitialization?.();
    await startup;

    expect(startBackgroundRuntime).toHaveBeenCalledTimes(1);
    expect(ensureRuntimeStateInitialized.mock.invocationCallOrder[0]).toBeLessThan(
      startBackgroundRuntime.mock.invocationCallOrder[0]
    );
  });
});
