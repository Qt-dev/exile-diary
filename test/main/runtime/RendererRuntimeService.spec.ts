jest.mock('../../../src/main/db/repositories/run', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/main/SettingsManager', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/main/GGGAPI', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/main/AuthManager', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/main/StatsManager', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/main/StashTabsManager', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/main/modules/StashGetter', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/main/RendererLogger', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/main/modules/ClientTxtWatcher', () => ({}));
jest.mock('../../../src/main/pricing/matching/ItemPricer', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/main/modules/RunParser', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/main/SearchManager', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/main/pricing/PricingService', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/main/db/repositories/items', () => ({
  __esModule: true,
  default: {},
}));

describe('RendererRuntimeService', () => {
  async function loadFactory() {
    return (await import('../../../src/main/runtime-core/RendererRuntimeService'))
      .createRendererRuntimeService;
  }

  async function loadDependencyPickers() {
    return await import('../../../src/main/runtime-core/rendererRuntimeDependencies');
  }

  function createDeps() {
    return {
      runs: {
        getLastRuns: jest.fn(),
        getRun: jest.fn(),
      },
      settingsManager: {
        get: jest.fn(),
        getAll: jest.fn(),
        set: jest.fn(),
      },
      gggApi: {
        getAllCharacters: jest.fn(),
        getAllStashTabs: jest.fn(),
      },
      authManager: {
        getAuthInfo: jest.fn(),
        isAuthenticated: jest.fn(),
        logout: jest.fn(),
      },
      statsManager: {
        getAllStats: jest.fn(),
        getAllMapNames: jest.fn(),
        getAllPossibleMods: jest.fn(),
        triggerProfitPerHourAnnouncer: jest.fn(),
      },
      stashTabsManager: {
        getStashData: jest.fn(),
        refresh: jest.fn(),
      },
      stashGetter: {
        refreshInterval: jest.fn(),
      },
      rendererLogger: {
        log: jest.fn(),
      },
      clientTxtWatcher: {
        checkValidLogfile: jest.fn(),
      },
      itemPricer: {
        getCurrencyByName: jest.fn(),
      },
      runParser: {
        reprocessRuns: jest.fn(),
        reprocessRun: jest.fn(),
        recheckGained: jest.fn(),
      },
      searchManager: {
        search: jest.fn(),
      },
      rateGetter: {
        update: jest.fn(),
      },
      itemsDb: {
        updateIgnoredItems: jest.fn(),
      },
      now: jest.fn(() => '20260704'),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns full or filtered settings snapshots from the settings repository', async () => {
    const createRendererRuntimeService = await loadFactory();
    const deps = createDeps();
    deps.settingsManager.getAll.mockReturnValue({
      activeProfile: { league: 'Mirage' },
      overlayEnabled: true,
      screenshotDir: 'C:/screens',
    });
    const runtime = createRendererRuntimeService(deps as any);

    await expect(runtime.getSettings()).resolves.toEqual({
      activeProfile: { league: 'Mirage' },
      overlayEnabled: true,
      screenshotDir: 'C:/screens',
    });
    await expect(runtime.getSettings(['overlayEnabled', 'missingKey'])).resolves.toEqual({
      overlayEnabled: true,
      missingKey: undefined,
    });
  });

  it('validates and persists settings updates before notifying the renderer log', async () => {
    const createRendererRuntimeService = await loadFactory();
    const deps = createDeps();
    deps.settingsManager.set.mockResolvedValue(undefined);
    const runtime = createRendererRuntimeService(deps as any);

    await runtime.saveSettings({
      clientTxt: 'D:/Games/Path of Exile/logs/Client.txt',
      overlayEnabled: false,
    });

    expect(deps.clientTxtWatcher.checkValidLogfile).toHaveBeenCalledWith(
      'D:/Games/Path of Exile/logs/Client.txt'
    );
    expect(deps.settingsManager.set.mock.calls).toEqual([
      ['clientTxt', 'D:/Games/Path of Exile/logs/Client.txt'],
      ['overlayEnabled', false],
    ]);
    expect(deps.rendererLogger.log).toHaveBeenCalledWith({
      messages: [{ text: 'Settings saved' }],
    });
  });

  it('hydrates stats with the resolved league context and current divine price', async () => {
    const createRendererRuntimeService = await loadFactory();
    const deps = createDeps();
    deps.settingsManager.get.mockImplementation((key: string) =>
      key === 'activeProfile' ? { league: 'Mirage', characterName: 'Mapper' } : null
    );
    deps.statsManager.getAllStats.mockResolvedValue({ runs: 42 });
    deps.itemPricer.getCurrencyByName.mockResolvedValue(180);
    const runtime = createRendererRuntimeService(deps as any);

    await expect(runtime.getAllStats()).resolves.toEqual({
      runs: 42,
      divinePrice: 180,
    });

    expect(deps.statsManager.getAllStats).toHaveBeenCalledWith({
      league: 'Mirage',
      characterName: 'Mapper',
    });
    expect(deps.itemPricer.getCurrencyByName).toHaveBeenCalledWith(
      'Divine Orb',
      '20260704',
      'Mirage'
    );
  });

  it('marks tracked stash tabs consistently for parent and child tabs', async () => {
    const createRendererRuntimeService = await loadFactory();
    const deps = createDeps();
    deps.settingsManager.get.mockImplementation((key: string) => {
      if (key === 'activeProfile') {
        return { league: 'Mirage' };
      }
      if (key === 'trackedStashTabs') {
        return { Mirage: ['currency', 'child-1'] };
      }
      return null;
    });
    deps.gggApi.getAllStashTabs.mockResolvedValue([
      { id: 'currency', name: 'Currency' },
      {
        id: 'quad',
        name: 'Quad',
        children: [{ id: 'child-1', name: 'Fragments' }],
      },
    ]);
    deps.stashTabsManager.getStashData.mockResolvedValue({ value: 1234, items: [{ id: 'a' }] });
    const runtime = createRendererRuntimeService(deps as any);

    await expect(runtime.getStashTabs()).resolves.toEqual({
      stashTabs: [
        { id: 'currency', name: 'Currency', tracked: true, children: undefined },
        {
          id: 'quad',
          name: 'Quad',
          tracked: false,
          children: [{ id: 'child-1', name: 'Fragments', tracked: true }],
        },
      ],
      data: { value: 1234, items: [{ id: 'a' }] },
    });
  });

  it('stores normalized stash tracking ids and refresh intervals through the runtime seam', async () => {
    const createRendererRuntimeService = await loadFactory();
    const deps = createDeps();
    deps.settingsManager.get.mockImplementation((key: string) => {
      if (key === 'activeProfile') {
        return { league: 'Mirage' };
      }
      if (key === 'trackedStashTabs') {
        return { Ancestor: ['legacy'] };
      }
      return null;
    });
    deps.settingsManager.set.mockResolvedValue(undefined);
    const runtime = createRendererRuntimeService(deps as any);

    await runtime.saveStashTabs([{ id: 'b' }, { id: 'a' }, { id: 'b' }]);
    await runtime.saveStashRefreshInterval(900);

    expect(deps.settingsManager.set).toHaveBeenNthCalledWith(1, 'trackedStashTabs', {
      Ancestor: ['legacy'],
      Mirage: ['a', 'b'],
    });
    expect(deps.settingsManager.set).toHaveBeenNthCalledWith(2, 'netWorthCheck', {
      interval: 900,
    });
    expect(deps.stashGetter.refreshInterval).toHaveBeenCalledTimes(1);
  });

  it('routes search, debug, and item-update commands through runtime dependencies', async () => {
    const createRendererRuntimeService = await loadFactory();
    const deps = createDeps();
    deps.rateGetter.update.mockResolvedValue(undefined);
    deps.stashTabsManager.refresh.mockResolvedValue(undefined);
    deps.runParser.recheckGained.mockResolvedValue(undefined);
    deps.itemsDb.updateIgnoredItems.mockResolvedValue(undefined);
    const runtime = createRendererRuntimeService(deps as any);

    await runtime.triggerSearch({ query: 'headhunter' });
    await runtime.debugFetchRates();
    await runtime.debugFetchStashTabs();
    await runtime.debugRecheckGain('2026-07-01', '2026-07-04');
    await runtime.updateItemsIgnoreStatus([{ id: 'item-1', status: true }]);

    expect(deps.searchManager.search).toHaveBeenCalledWith({ query: 'headhunter' });
    expect(deps.rateGetter.update).toHaveBeenCalledWith(true);
    expect(deps.stashTabsManager.refresh).toHaveBeenCalledTimes(1);
    expect(deps.runParser.recheckGained).toHaveBeenCalledWith('2026-07-01', '2026-07-04');
    expect(deps.itemsDb.updateIgnoredItems).toHaveBeenCalledWith([{ id: 'item-1', status: true }]);
  });

  it('scopes each use-case to a narrowed dependency contract', async () => {
    const deps = createDeps();
    const {
      pickRendererRunUseCaseDependencies,
      pickRendererSettingsUseCaseDependencies,
      pickRendererStashUseCaseDependencies,
      pickRendererStatsUseCaseDependencies,
    } = await loadDependencyPickers();

    expect(Object.keys(pickRendererRunUseCaseDependencies(deps as any)).sort()).toEqual([
      'itemsDb',
      'rendererLogger',
      'runParser',
      'runs',
    ]);
    expect(Object.keys(pickRendererSettingsUseCaseDependencies(deps as any)).sort()).toEqual([
      'authManager',
      'clientTxtWatcher',
      'gggApi',
      'rendererLogger',
      'settingsManager',
    ]);
    expect(Object.keys(pickRendererStashUseCaseDependencies(deps as any)).sort()).toEqual([
      'gggApi',
      'settingsManager',
      'stashGetter',
      'stashTabsManager',
    ]);
    expect(Object.keys(pickRendererStatsUseCaseDependencies(deps as any)).sort()).toEqual([
      'itemPricer',
      'now',
      'rateGetter',
      'searchManager',
      'settingsManager',
      'statsManager',
    ]);
  });
});
