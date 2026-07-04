describe('createAppWindows', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('points both windows at the main-process preload bundle', async () => {
    jest.doMock('electron-overlay-window', () => ({
      OVERLAY_WINDOW_OPTS: {},
    }));

    const electron = await import('electron');
    const { createAppWindows } = await import('../../../src/main/windows/createAppWindows');

    createAppWindows();

    expect(electron.BrowserWindow).toHaveBeenCalledTimes(2);

    const mainWindowOptions = (electron.BrowserWindow as jest.Mock).mock.calls[0][0];
    const overlayWindowOptions = (electron.BrowserWindow as jest.Mock).mock.calls[1][0];

    expect(mainWindowOptions.webPreferences.preload).toContain('preload.js');
    expect(mainWindowOptions.webPreferences.preload).toContain('..');
    expect(overlayWindowOptions.webPreferences.preload).toBe(
      mainWindowOptions.webPreferences.preload
    );
  });
});
