export const runtimeRendererMethodKeys = [
  'loadRuns',
  'loadRun',
  'loadRunDetails',
  'reprocessRuns',
  'reprocessRun',
  'getSettings',
  'getCharacters',
  'saveSettings',
  'saveStashTabs',
  'saveStashRefreshInterval',
  'saveFilterSettings',
  'getOAuthInfo',
  'isAuthenticated',
  'logout',
  'getOverlayPersistence',
  'getAllStats',
  'getStashTabs',
  'triggerSearch',
  'getDivinePrice',
  'getAllMapNames',
  'getAllPossibleMods',
  'refreshProfitPerHour',
  'debugRecheckGain',
  'debugFetchRates',
  'debugFetchStashTabs',
  'updateItemsIgnoreStatus',
] as const;

export type RuntimeRendererMethodKey = (typeof runtimeRendererMethodKeys)[number];

export const runtimeMethodKeys = [
  'runTracking.refreshTracking',
  'runTracking.setCurrentMapStats',
  'runTracking.tryProcess',
  'runTracking.tryUpdateCurrentArea',
  'runTracking.getLatestGeneratedArea',
  'pricing.getCurrencyByName',
  'pricing.updateRates',
  'stats.triggerProfitPerHourAnnouncer',
  'stash.getNetWorth',
  'stash.refresh',
] as const;

export type RuntimeMethodKey = (typeof runtimeMethodKeys)[number];

export const runtimeSidecarEventNames = {
  rendererLog: 'renderer-log',
  searchMessage: 'search-message',
  pricesUpdated: 'prices-updated',
  settingsChanged: 'settings-changed',
  profitPerHourUpdated: 'profit-per-hour-updated',
  runLatestAreaUpdated: 'run-latest-area-updated',
  runProcessed: 'run-processed',
  incubatorsUpdated: 'incubators-updated',
  incubatorsMissing: 'incubators-missing',
  ratesGettingPrices: 'rates-getting-prices',
  ratesDoneGettingPrices: 'rates-done-getting-prices',
  ratesGettingPricesFailed: 'rates-getting-prices-failed',
  clientTxtFileError: 'client-txt-file-error',
  clientTxtNotUpdated: 'client-txt-not-updated',
  localChatDisabled: 'local-chat-disabled',
  generatedRun: 'generated-run',
  enteredMap: 'entered-map',
  stashTabsUpdatedFull: 'stash-tabs-updated-full',
  netWorthUpdated: 'net-worth-updated',
  runtimeStarted: 'runtime-started',
} as const;

export type RuntimeSidecarEventName =
  (typeof runtimeSidecarEventNames)[keyof typeof runtimeSidecarEventNames];

export type RuntimeSidecarRequest =
  | {
      type: 'request';
      requestId: string;
      command: 'health-check' | 'shutdown';
    }
  | {
      type: 'request';
      requestId: string;
      command: 'renderer-method';
      payload: {
        method: RuntimeRendererMethodKey;
        args: any[];
      };
    }
  | {
      type: 'request';
      requestId: string;
      command: 'runtime-method';
      payload: {
        method: RuntimeMethodKey;
        args: any[];
      };
    };

export type RuntimeSidecarResponse = {
  type: 'response';
  requestId: string;
  ok: boolean;
  result?: unknown;
  error?: {
    message: string;
    stack?: string;
  };
};

export type RuntimeSidecarEvent = {
  type: 'event';
  eventName: RuntimeSidecarEventName;
  payload?: unknown;
};

export type RuntimeSidecarReadyMessage = {
  type: 'ready';
  pid: number;
  startedAt: string;
};
