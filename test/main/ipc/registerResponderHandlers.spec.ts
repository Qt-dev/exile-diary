describe('registerResponderHandlers', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('binds every typed responder contract to ipcMain.handle', async () => {
    const { invokeChannels } = await import('../../../src/shared/contracts/exileDiaryApi');
    const responderStub = {
      getAppGlobals: jest.fn(),
      loadRuns: jest.fn(),
      loadRun: jest.fn(),
      loadRunDetails: jest.fn(),
      reprocessRuns: jest.fn(),
      reprocessRun: jest.fn(),
      getSettings: jest.fn(),
      getCharacters: jest.fn(),
      saveSettings: jest.fn(),
      getOAuthInfo: jest.fn(),
      isAuthenticated: jest.fn(),
      logout: jest.fn(),
      getAllStats: jest.fn(),
      getStashTabs: jest.fn(),
      saveStashTabs: jest.fn(),
      saveStashRefreshInterval: jest.fn(),
      saveFilterSettings: jest.fn(),
      triggerSearch: jest.fn(),
      getDivinePrice: jest.fn(),
      getAllMapNames: jest.fn(),
      getAllPossibleMods: jest.fn(),
      refreshProfitPerHour: jest.fn(),
      debugRecheckGain: jest.fn(),
      debugFetchRates: jest.fn(),
      debugFetchStashTabs: jest.fn(),
      getOverlayPersistence: jest.fn(),
      updateItemsIgnoreStatus: jest.fn(),
    };

    jest.doMock('../../../src/main/Responder', () => ({
      __esModule: true,
      default: responderStub,
    }));

    const electron = await import('electron');
    const { responderHandlerKeys, registerResponderHandlers } = await import(
      '../../../src/main/ipc/registerResponderHandlers'
    );

    registerResponderHandlers();

    expect(electron.ipcMain.handle).toHaveBeenCalledTimes(responderHandlerKeys.length);

    for (const handlerKey of responderHandlerKeys) {
      expect(electron.ipcMain.handle).toHaveBeenCalledWith(
        invokeChannels[handlerKey],
        responderStub[handlerKey]
      );
    }
  });
});
