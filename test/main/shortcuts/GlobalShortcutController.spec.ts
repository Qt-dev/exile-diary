const shortcutLoggerWarn = jest.fn();
jest.mock('electron-log', () => ({
  __esModule: true,
  default: {
    scope: jest.fn(() => ({ warn: shortcutLoggerWarn })),
  },
}));

describe('GlobalShortcutController', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('registers base and optional shortcuts from the configured settings', async () => {
    const electron = await import('electron');
    const { GlobalShortcutController } = await import(
      '../../../src/main/shortcuts/GlobalShortcutController'
    );

    const toggleOverlayPersistence = jest.fn();
    const toggleOverlayMovement = jest.fn(() => true);
    const triggerRunParse = jest.fn();
    const triggerScreenshot = jest.fn();

    const controller = new GlobalShortcutController({
      getShortcut: (key) =>
        ({
          overlayToggleShortcut: 'Ctrl+7',
          overlayMovementShortcut: 'Ctrl+9',
          runParseShortcut: 'Ctrl+10',
          screenshotShortcut: 'Ctrl+8',
        }[key] ?? null),
      isRunParseScreenshotEnabled: () => true,
      areCustomScreenshotsEnabled: () => true,
      toggleOverlayPersistence,
      toggleOverlayMovement,
      triggerRunParse,
      triggerScreenshot,
    });

    controller.registerAll();

    expect(electron.globalShortcut.register).toHaveBeenCalledTimes(4);
    expect(electron.globalShortcut.register).toHaveBeenNthCalledWith(
      1,
      'Ctrl+7',
      expect.any(Function)
    );
    expect(electron.globalShortcut.register).toHaveBeenNthCalledWith(
      2,
      'Ctrl+9',
      expect.any(Function)
    );
    expect(electron.globalShortcut.register).toHaveBeenNthCalledWith(
      3,
      'Ctrl+10',
      expect.any(Function)
    );
    expect(electron.globalShortcut.register).toHaveBeenNthCalledWith(
      4,
      'Ctrl+8',
      expect.any(Function)
    );

    const overlayToggleCallback = (electron.globalShortcut.register as jest.Mock).mock.calls[0][1];
    const overlayMovementCallback = (electron.globalShortcut.register as jest.Mock).mock
      .calls[1][1];
    const runParseCallback = (electron.globalShortcut.register as jest.Mock).mock.calls[2][1];
    const screenshotCallback = (electron.globalShortcut.register as jest.Mock).mock.calls[3][1];

    overlayToggleCallback();
    overlayMovementCallback();
    runParseCallback();
    screenshotCallback();

    expect(toggleOverlayPersistence).toHaveBeenCalledTimes(1);
    expect(toggleOverlayMovement).toHaveBeenCalledTimes(1);
    expect(triggerRunParse).toHaveBeenCalledTimes(1);
    expect(triggerScreenshot).toHaveBeenCalledTimes(1);
  });

  it('re-registers shortcuts by clearing the old registrations first', async () => {
    const electron = await import('electron');
    const { GlobalShortcutController } = await import(
      '../../../src/main/shortcuts/GlobalShortcutController'
    );

    const controller = new GlobalShortcutController({
      getShortcut: () => null,
      isRunParseScreenshotEnabled: () => false,
      areCustomScreenshotsEnabled: () => false,
      toggleOverlayPersistence: jest.fn(),
      toggleOverlayMovement: jest.fn(() => false),
      triggerRunParse: jest.fn(),
      triggerScreenshot: jest.fn(),
    });

    controller.reregisterAll();

    expect(electron.globalShortcut.unregisterAll).toHaveBeenCalledTimes(1);
    expect(electron.globalShortcut.register).toHaveBeenCalledTimes(2);
  });

  it('reports shortcut registration conflicts', async () => {
    const electron = await import('electron');
    (electron.globalShortcut.register as jest.Mock).mockReturnValueOnce(false);
    const { GlobalShortcutController } = await import(
      '../../../src/main/shortcuts/GlobalShortcutController'
    );
    const controller = new GlobalShortcutController({
      getShortcut: () => null,
      isRunParseScreenshotEnabled: () => false,
      areCustomScreenshotsEnabled: () => false,
      toggleOverlayPersistence: jest.fn(),
      toggleOverlayMovement: jest.fn(() => false),
      triggerRunParse: jest.fn(),
      triggerScreenshot: jest.fn(),
    });

    controller.registerAll();

    expect(shortcutLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('Unable to register shortcut')
    );
  });
});
