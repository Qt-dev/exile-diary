export const invokeChannels = {
  getAppGlobals: 'app-globals',
  loadRuns: 'load-runs',
  loadRun: 'load-run',
  loadRunDetails: 'load-run-details',
  reprocessRuns: 'debug:reprocess-runs',
  reprocessRun: 'reprocess-run',
  getSettings: 'get-settings',
  getCharacters: 'get-characters',
  saveSettings: 'save-settings',
  getOAuthInfo: 'oauth:get-info',
  isAuthenticated: 'oauth:is-authenticated',
  logout: 'oauth:logout',
  getAllStats: 'get-all-stats',
  getStashTabs: 'get-stash-tabs',
  saveStashTabs: 'save-settings:stashtabs',
  saveStashRefreshInterval: 'save-settings:stash-refresh-interval',
  saveFilterSettings: 'save-settings:filters',
  triggerSearch: 'search:trigger',
  getDivinePrice: 'get-divine-price',
  getAllMapNames: 'get-all-map-names',
  getAllPossibleMods: 'get-all-possible-mods',
  refreshProfitPerHour: 'refresh-profit-per-hour',
  debugRecheckGain: 'debug:recheck-gain',
  debugFetchRates: 'debug:fetch-rates',
  debugFetchStashTabs: 'debug:fetch-stash-tabs',
  getOverlayPersistence: 'overlay:get-persistence',
  updateItemsIgnoreStatus: 'items:filters:db-update',
  getOverlayPosition: 'overlay:get-position',
  openFileDialog: 'open-file-dialog',
  showCharacterDbFile: 'show-character-db-file',
} as const;

export const sendChannels = {
  reloadApp: 'reload-app',
  downloadUpdate: 'download-update',
  applyUpdate: 'apply-update',
  appBooted: 'app:booted',
  rendererLog: 'renderer:log',
  notifyFiltersUiUpdated: 'settings:filters:ui-updated',
  refreshUi: 'ui:refresh',
  requestNetWorthRefresh: 'get-net-worth',
  setOverlayClickable: 'overlay:make-clickable',
  setOverlayPosition: 'overlay:set-position',
  disableHotkeys: 'hotkeys:disable',
  enableHotkeys: 'hotkeys:enable',
} as const;

export const rendererBootEvent = 'exile-diary:app-booted';

export const rendererEventChannels = {
  refreshRuns: 'refresh-runs',
  currentRunStarted: 'current-run:started',
  currentRunInfo: 'current-run:info',
  oauthLoggedOut: 'oauth:logged-out',
  oauthExpiredToken: 'oauth:expired-token',
  oauthAuthFailure: 'oauth:auth-failure',
  oauthReceivedCode: 'oauth:received-code',
  oauthAuthSuccess: 'oauth:auth-success',
  settingsFiltersUpdated: 'settings:filters:updated',
  settingsAutoscrollUpdated: 'settings:autoscroll:updated',
  settingsOverlayPersistenceChanged: 'settings:overlay-persistence-changed',
  addLog: 'add-log',
  logAutoscroll: 'log-autoscroll',
  searchResults: 'search:register-results',
  stashTabsUpdated: 'stashTabs:frontend:update',
  updateNetWorth: 'update-net-worth',
  updateProfitPerHour: 'update-profit-per-hour',
  itemsFiltersUpdate: 'items:filters:update',
  pricesUpdated: 'prices:updated',
  overlayTriggerReposition: 'overlay:trigger-reposition',
  overlaySetPersistence: 'overlay:set-persistence',
  overlayToggleMovement: 'overlay:toggle-movement',
  overlayMessage: 'overlay:message',
} as const;

export type ExileDiaryLogAction =
  | (typeof sendChannels)['reloadApp']
  | (typeof sendChannels)['downloadUpdate']
  | (typeof sendChannels)['applyUpdate'];

export type AppGlobals = {
  appPath: string;
  appLocale: string;
  appVersion: string;
};

export type OverlayPosition = {
  x: number;
  y: number;
};

export type OpenFileDialogFilter = {
  name: string;
  extensions: string[];
};

export type OpenFileDialogProperty =
  | 'openFile'
  | 'openDirectory'
  | 'multiSelections'
  | 'showHiddenFiles'
  | 'createDirectory'
  | 'promptToCreate'
  | 'noResolveAliases'
  | 'treatPackageAsDirectory'
  | 'dontAddToRecent';

export type OpenFileDialogOptions = {
  title?: string;
  filters?: OpenFileDialogFilter[];
  properties?: OpenFileDialogProperty[];
};

export type OpenFileDialogResult = {
  canceled: boolean;
  filePaths: string[];
};

export type MapNameOption = { name: string };
export type MapModOption = { mod: string };

export type RendererLogLevel = 'debug' | 'error' | 'info' | 'log' | 'warn';

export type RendererLogPayload = {
  level: RendererLogLevel;
  message: string;
  scope?: string;
  source?: 'console' | 'global-error' | 'unhandled-rejection' | 'bootstrap';
  stack?: string;
  timestamp?: string;
};

export type OverlayMessage = {
  text: string;
  type?: string;
  link?: string;
  linkEvent?: ExileDiaryLogAction;
  icon?: string;
  price?: number;
  divinePrice?: number;
};

export type CurrentRunState = {
  area?: string;
  name?: string;
  level?: number | null;
  iir?: number | null;
  pack_size?: number | null;
  iiq?: number | null;
};

export type ProfitPerHourPayload = {
  profitPerHour: {
    daily: number;
    hourly: number;
  };
  divinePrice: number;
};

export type NetWorthPayload = {
  value: number;
  change: number;
  divinePrice: number;
};

export type OverlayMovementState = {
  isOverlayMoveable: boolean;
};

export type SearchResultsPayload = {
  items: any[];
  runs: any[];
};

export type StashTabsPayload = {
  stashTabs: any[];
  data: {
    items: any[];
    value: number;
  };
};

export type ExileDiaryRendererEventPayloads = {
  refreshRuns: void;
  currentRunStarted: CurrentRunState;
  currentRunInfo: CurrentRunState;
  oauthLoggedOut: void;
  oauthExpiredToken: void;
  oauthAuthFailure: unknown;
  oauthReceivedCode: unknown;
  oauthAuthSuccess: unknown;
  settingsFiltersUpdated: any;
  settingsAutoscrollUpdated: boolean;
  settingsOverlayPersistenceChanged: boolean;
  addLog: {
    id?: string;
    timestamp?: string;
    messages: OverlayMessage[];
    link?: string;
  };
  logAutoscroll: void;
  searchResults: SearchResultsPayload;
  stashTabsUpdated: any;
  updateNetWorth: NetWorthPayload;
  updateProfitPerHour: ProfitPerHourPayload;
  itemsFiltersUpdate: void;
  pricesUpdated: {
    prices: Record<string, number>;
  };
  overlayTriggerReposition: void;
  overlaySetPersistence: boolean;
  overlayToggleMovement: OverlayMovementState;
  overlayMessage: {
    messages: OverlayMessage[];
  };
};

export type ExileDiaryRendererEventName = keyof ExileDiaryRendererEventPayloads;

export type ExileDiaryListener<K extends ExileDiaryRendererEventName> = (
  payload: ExileDiaryRendererEventPayloads[K]
) => void;

export interface ExileDiaryApi {
  getAppGlobals(): Promise<AppGlobals>;
  loadRuns(size: number): Promise<any[]>;
  loadRun(runId: string | number): Promise<any>;
  loadRunDetails(runId: string | number): Promise<any>;
  reprocessRuns(): Promise<void>;
  reprocessRun(runId: string | number): Promise<any>;
  getSettings(keys?: string[]): Promise<Record<string, any>>;
  getCharacters(): Promise<any[]>;
  saveSettings(settings: Record<string, any>): Promise<void>;
  getOAuthInfo(): Promise<{ code_challenge: string; state: string }>;
  isAuthenticated(): Promise<boolean>;
  logout(): Promise<void>;
  getAllStats(params?: Record<string, any>): Promise<any>;
  getStashTabs(): Promise<StashTabsPayload>;
  saveStashTabs(stashTabs: any[]): Promise<void>;
  saveStashRefreshInterval(interval: number): Promise<void>;
  saveFilterSettings(filters: Record<string, any>): Promise<void>;
  triggerSearch(params: Record<string, any>): Promise<void>;
  getDivinePrice(): Promise<number>;
  getAllMapNames(): Promise<MapNameOption[]>;
  getAllPossibleMods(): Promise<MapModOption[]>;
  refreshProfitPerHour(): Promise<void>;
  debugRecheckGain(from?: string, to?: string): Promise<void>;
  debugFetchRates(): Promise<void>;
  debugFetchStashTabs(): Promise<void>;
  getOverlayPersistence(): Promise<boolean>;
  getOverlayPosition(): Promise<OverlayPosition>;
  updateItemsIgnoreStatus(data: Array<{ id: string; status: boolean }>): Promise<void>;
  openFileDialog(options: OpenFileDialogOptions): Promise<OpenFileDialogResult>;
  showCharacterDbFile(): Promise<void>;
  refreshUi(): void;
  notifyFiltersUiUpdated(): void;
  requestNetWorthRefresh(): void;
  setOverlayClickable(clickable: boolean): void;
  setOverlayPosition(position: OverlayPosition): void;
  disableHotkeys(): void;
  enableHotkeys(): void;
  triggerLogAction(action: ExileDiaryLogAction): void;
  logRendererMessage(payload: RendererLogPayload): void;
  openExternal(url: string): Promise<void>;
  on<K extends ExileDiaryRendererEventName>(
    eventName: K,
    listener: ExileDiaryListener<K>
  ): () => void;
}
