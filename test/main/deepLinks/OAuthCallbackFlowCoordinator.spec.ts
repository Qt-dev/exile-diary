import { OAuthCallbackFlowCoordinator } from '../../../src/main/deepLinks/OAuthCallbackFlowCoordinator';

describe('OAuthCallbackFlowCoordinator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not process callbacks until it is ready', async () => {
    const processProtocolUrl = jest.fn(async () => undefined);
    const coordinator = new OAuthCallbackFlowCoordinator({ processProtocolUrl });

    await coordinator.handleProtocolUrl('exile-diary://auth?code=abc&state=xyz');

    expect(processProtocolUrl).not.toHaveBeenCalled();
    expect(coordinator.getQueueLength()).toBe(1);

    await coordinator.setReady();

    expect(processProtocolUrl).toHaveBeenCalledWith('exile-diary://auth?code=abc&state=xyz');
    expect(coordinator.getQueueLength()).toBe(0);
  });

  it('processes queued callbacks sequentially without overlap', async () => {
    let releaseFirstCallback: (() => void) | null = null;
    const processProtocolUrl = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseFirstCallback = resolve;
          })
      )
      .mockImplementationOnce(async () => undefined);

    const coordinator = new OAuthCallbackFlowCoordinator({ processProtocolUrl });
    await coordinator.setReady();

    const firstPromise = coordinator.handleProtocolUrl('exile-diary://auth?code=first&state=xyz');
    const secondPromise = coordinator.handleProtocolUrl('exile-diary://auth?code=second&state=xyz');

    expect(processProtocolUrl).toHaveBeenCalledTimes(1);
    expect(processProtocolUrl).toHaveBeenNthCalledWith(
      1,
      'exile-diary://auth?code=first&state=xyz'
    );
    expect(coordinator.getIsProcessing()).toBe(true);
    expect(coordinator.getQueueLength()).toBe(1);

    releaseFirstCallback?.();
    await firstPromise;
    await secondPromise;

    expect(processProtocolUrl).toHaveBeenCalledTimes(2);
    expect(processProtocolUrl).toHaveBeenNthCalledWith(
      2,
      'exile-diary://auth?code=second&state=xyz'
    );
    expect(coordinator.getIsProcessing()).toBe(false);
    expect(coordinator.getQueueLength()).toBe(0);
  });
});
