describe('registerShellHandlers', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('registers shell-only IPC handlers and delegates actions to shell services', async () => {
    const overlayGetMock = jest.fn((key) => {
      if (key === 'overlayPosition') {
        return { x: 10, y: 20 };
      }

      if (key === 'activeProfile') {
        return { characterName: 'Ranger', league: 'Settlers' };
      }

      return null;
    });
    const overlaySetMock = jest.fn();
    const getCharacterDbPathMock = jest.fn(() => '/tmp/character.db');

    jest.doMock('../../../src/main/SettingsManager', () => ({
      __esModule: true,
      default: {
        get: overlayGetMock,
        set: overlaySetMock,
      },
    }));
    jest.doMock('../../../src/main/db', () => ({
      __esModule: true,
      default: {
        getCharacterDbPath: getCharacterDbPathMock,
      },
    }));

    const electron = await import('electron');
    const { invokeChannels, rendererEventChannels, sendChannels } = await import(
      '../../../src/shared/contracts/exileDiaryApi'
    );
    const { registerShellHandlers } = await import('../../../src/main/ipc/registerShellHandlers');

    const mainWindow = {} as any;
    const overlayWindow = {
      setIgnoreMouseEvents: jest.fn(),
    } as any;
    const sendToMain = jest.fn();
    const refreshWindows = jest.fn();
    const registerHotkeys = jest.fn();
    const unregisterHotkeys = jest.fn();

    (electron.dialog.showOpenDialog as jest.Mock).mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/foo'],
    });

    registerShellHandlers({
      windows: { mainWindow, overlayWindow },
      sendToMain,
      refreshWindows,
      registerHotkeys,
      unregisterHotkeys,
    });

    const onCalls = electron.ipcMain.on as jest.Mock;
    const handleCalls = electron.ipcMain.handle as jest.Mock;

    const refreshUiHandler = onCalls.mock.calls.find(
      ([channel]) => channel === sendChannels.refreshUi
    )?.[1];
    const notifyFiltersHandler = onCalls.mock.calls.find(
      ([channel]) => channel === sendChannels.notifyFiltersUiUpdated
    )?.[1];
    const disableHotkeysHandler = onCalls.mock.calls.find(
      ([channel]) => channel === sendChannels.disableHotkeys
    )?.[1];
    const enableHotkeysHandler = onCalls.mock.calls.find(
      ([channel]) => channel === sendChannels.enableHotkeys
    )?.[1];
    const overlayClickableHandler = onCalls.mock.calls.find(
      ([channel]) => channel === sendChannels.setOverlayClickable
    )?.[1];
    const overlayPositionHandler = onCalls.mock.calls.find(
      ([channel]) => channel === sendChannels.setOverlayPosition
    )?.[1];

    await refreshUiHandler();
    await notifyFiltersHandler();
    await disableHotkeysHandler();
    await enableHotkeysHandler();
    await overlayClickableHandler(null, { clickable: true });
    await overlayPositionHandler(null, { x: 44, y: 55 });

    expect(refreshWindows).toHaveBeenCalledTimes(1);
    expect(sendToMain).toHaveBeenCalledWith(rendererEventChannels.itemsFiltersUpdate);
    expect(unregisterHotkeys).toHaveBeenCalledTimes(1);
    expect(registerHotkeys).toHaveBeenCalledTimes(1);
    expect(overlayWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(false);
    expect(overlaySetMock).toHaveBeenCalledWith('overlayPosition', { x: 44, y: 55 });

    const overlayPositionHandle = handleCalls.mock.calls.find(
      ([channel]) => channel === invokeChannels.getOverlayPosition
    )?.[1];
    const fileDialogHandle = handleCalls.mock.calls.find(
      ([channel]) => channel === invokeChannels.openFileDialog
    )?.[1];
    const showDbHandle = handleCalls.mock.calls.find(
      ([channel]) => channel === invokeChannels.showCharacterDbFile
    )?.[1];

    expect(overlayPositionHandle()).toEqual({ x: 10, y: 20 });
    await fileDialogHandle(null, { properties: ['openFile'] });
    await showDbHandle();

    expect(electron.dialog.showOpenDialog).toHaveBeenCalledWith(mainWindow, {
      properties: ['openFile'],
    });
    expect(getCharacterDbPathMock).toHaveBeenCalled();
    expect(electron.shell.showItemInFolder).toHaveBeenCalledWith('/tmp/character.db');
  });
});
