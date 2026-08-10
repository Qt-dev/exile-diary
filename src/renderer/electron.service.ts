import {
  AppGlobals,
  ExileDiaryApi,
  ExileDiaryLogAction,
  ExileDiaryRendererEventName,
  ExileDiaryRendererEventPayloads,
  OpenFileDialogOptions,
  OverlayPosition,
} from '../shared/contracts/exileDiaryApi';

type RendererLogger = {
  debug: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  log: (...args: unknown[]) => void;
  scope: (label: string) => RendererLogger;
  silly: (...args: unknown[]) => void;
  verbose: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

const getApi = (): ExileDiaryApi => {
  if (typeof window === 'undefined' || !window.exileDiary) {
    throw new Error('Exile Diary preload API is not available in this renderer context.');
  }

  return window.exileDiary;
};

const formatLogArgs = (label: string, args: unknown[]) => {
  const prefix = `[${label}]`;
  return [prefix, ...args];
};

const createRendererLogger = (label = 'renderer'): RendererLogger => ({
  debug: (...args) => console.debug(...formatLogArgs(label, args)),
  error: (...args) => console.error(...formatLogArgs(label, args)),
  info: (...args) => console.info(...formatLogArgs(label, args)),
  log: (...args) => console.log(...formatLogArgs(label, args)),
  scope: (nextLabel: string) => createRendererLogger(nextLabel),
  silly: (...args) => console.debug(...formatLogArgs(label, args)),
  verbose: (...args) => console.debug(...formatLogArgs(label, args)),
  warn: (...args) => console.warn(...formatLogArgs(label, args)),
});

let appGlobals: AppGlobals = {
  appLocale: '',
  appPath: '',
  appVersion: '',
};

const on = <K extends ExileDiaryRendererEventName>(
  eventName: K,
  listener: (payload: ExileDiaryRendererEventPayloads[K]) => void
) => getApi().on(eventName, listener);

export const electronService = {
  logger: createRendererLogger('renderer'),
  refreshGlobals: async () => {
    appGlobals = await getApi().getAppGlobals();
    return appGlobals;
  },
  getAppVersion: () => appGlobals.appVersion,
  getAppLocale: () => appGlobals.appLocale,
  getAppPath: () => appGlobals.appPath,
  getSettings: (keys?: string[]) => getApi().getSettings(keys),
  saveSettings: (settings: Record<string, any>) => getApi().saveSettings(settings),
  getCharacters: () => getApi().getCharacters(),
  isAuthenticated: () => getApi().isAuthenticated(),
  getOAuthInfo: () => getApi().getOAuthInfo(),
  logout: () => getApi().logout(),
  loadRuns: (size: number) => getApi().loadRuns(size),
  loadRun: (runId: string | number) => getApi().loadRun(runId),
  loadRunDetails: (runId: string | number) => getApi().loadRunDetails(runId),
  reprocessRuns: () => getApi().reprocessRuns(),
  reprocessRun: (runId: string | number) => getApi().reprocessRun(runId),
  getAllStats: (params?: Record<string, any>) => getApi().getAllStats(params),
  getStashTabs: () => getApi().getStashTabs(),
  saveStashTabs: (stashTabs: any[]) => getApi().saveStashTabs(stashTabs),
  saveStashRefreshInterval: (interval: number) => getApi().saveStashRefreshInterval(interval),
  saveFilterSettings: (filters: Record<string, any>) => getApi().saveFilterSettings(filters),
  triggerSearch: (params: Record<string, any>) => getApi().triggerSearch(params),
  getDivinePrice: () => getApi().getDivinePrice(),
  getAllMapNames: () => getApi().getAllMapNames(),
  getAllPossibleMods: () => getApi().getAllPossibleMods(),
  refreshProfitPerHour: () => getApi().refreshProfitPerHour(),
  debugRecheckGain: (from?: string, to?: string) => getApi().debugRecheckGain(from, to),
  debugFetchRates: () => getApi().debugFetchRates(),
  debugFetchStashTabs: () => getApi().debugFetchStashTabs(),
  getOverlayPersistence: () => getApi().getOverlayPersistence(),
  getOverlayPosition: async (): Promise<OverlayPosition> => {
    const position = await getApi().getOverlayPosition();
    return position ?? { x: 0, y: 0 };
  },
  setOverlayPosition: (position: OverlayPosition) => getApi().setOverlayPosition(position),
  setOverlayClickable: (clickable: boolean) => getApi().setOverlayClickable(clickable),
  updateItemsIgnoreStatus: (data: Array<{ id: string; status: boolean }>) =>
    getApi().updateItemsIgnoreStatus(data),
  listStrategies: () => getApi().listStrategies(),
  createStrategy: (input) => getApi().createStrategy(input),
  updateStrategy: (strategyId, input) => getApi().updateStrategy(strategyId, input),
  deleteStrategy: (strategyId) => getApi().deleteStrategy(strategyId),
  setRunStrategies: (runId, strategyIds) => getApi().setRunStrategies(runId, strategyIds),
  getStrategyStats: (strategyId) => getApi().getStrategyStats(strategyId),
  getPricesCatalog: (options?: any) => getApi().getPricesCatalog(options),
  getItemPriceDetails: (itemIdentifier: string, league?: string) =>
    getApi().getItemPriceDetails(itemIdentifier, league),
  addPriceOverride: (params: any) => getApi().addPriceOverride(params),
  deletePriceOverride: (itemIdentifier: string, league?: string) =>
    getApi().deletePriceOverride(itemIdentifier, league),
  recalculatePrices: (options?: any) =>
    getApi().recalculatePrices(options),
  openFileDialog: (options: OpenFileDialogOptions) => getApi().openFileDialog(options),
  showCharacterDbFile: () => getApi().showCharacterDbFile(),
  refreshUi: () => getApi().refreshUi(),
  notifyFiltersUiUpdated: () => getApi().notifyFiltersUiUpdated(),
  requestNetWorthRefresh: () => getApi().requestNetWorthRefresh(),
  disableHotkeys: () => getApi().disableHotkeys(),
  enableHotkeys: () => getApi().enableHotkeys(),
  triggerLogAction: (action: ExileDiaryLogAction) => getApi().triggerLogAction(action),
  openExternal: (url: string) => getApi().openExternal(url),
  on,
};
