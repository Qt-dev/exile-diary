/**
 * @jest-environment jsdom
 */

import {
  invokeChannels,
  rendererEventChannels,
  sendChannels,
} from '../../../src/shared/contracts/exileDiaryApi';

describe('ExileDiary preload bridge', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('exposes the typed preload API', async () => {
    const electron = await import('electron');
    await import('../../../src/main/preload');

    expect(electron.contextBridge.exposeInMainWorld).toHaveBeenCalledTimes(1);

    const [, api] = (electron.contextBridge.exposeInMainWorld as jest.Mock).mock.calls[0];

    expect(typeof api.getSettings).toBe('function');
    expect(typeof api.loadRuns).toBe('function');
    expect(typeof api.logRendererMessage).toBe('function');
    expect(typeof api.on).toBe('function');
    expect(typeof api.openExternal).toBe('function');
  });

  it('routes invocations, sends, and renderer subscriptions through the contract map', async () => {
    const electron = await import('electron');
    (electron.ipcRenderer.invoke as jest.Mock).mockResolvedValue({ appVersion: '1.0.0' });
    await import('../../../src/main/preload');

    const [, api] = (electron.contextBridge.exposeInMainWorld as jest.Mock).mock.calls[0];

    await api.getAppGlobals();
    await api.loadRuns(25);
    api.refreshUi();
    api.setOverlayPosition({ x: 12, y: 34 });
    api.logRendererMessage({ level: 'error', message: 'render failed', source: 'global-error' });
    api.openExternal('https://example.com');

    const listener = jest.fn();
    const unsubscribe = api.on('overlayMessage', listener);
    const subscription = (electron.ipcRenderer.on as jest.Mock).mock.calls[0][1];
    subscription({}, { messages: [{ text: 'hi' }] });
    unsubscribe();

    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(invokeChannels.getAppGlobals);
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(invokeChannels.loadRuns, { size: 25 });
    expect(electron.ipcRenderer.send).toHaveBeenCalledWith(sendChannels.refreshUi);
    expect(electron.ipcRenderer.send).toHaveBeenCalledWith(sendChannels.setOverlayPosition, {
      x: 12,
      y: 34,
    });
    expect(electron.ipcRenderer.send).toHaveBeenCalledWith(sendChannels.rendererLog, {
      level: 'error',
      message: 'render failed',
      source: 'global-error',
    });
    expect(electron.shell.openExternal).toHaveBeenCalledWith('https://example.com');
    expect(electron.ipcRenderer.on).toHaveBeenCalledWith(
      rendererEventChannels.overlayMessage,
      expect.any(Function)
    );
    expect(listener).toHaveBeenCalledWith({ messages: [{ text: 'hi' }] });
    expect(electron.ipcRenderer.removeListener).toHaveBeenCalledWith(
      rendererEventChannels.overlayMessage,
      expect.any(Function)
    );
  });
});
