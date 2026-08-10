import { contextBridge, ipcRenderer, shell } from 'electron';
import {
  ExileDiaryApi,
  ExileDiaryListener,
  ExileDiaryLogAction,
  ExileDiaryRendererEventName,
  invokeChannels,
  rendererBootEvent,
  rendererEventChannels,
  sendChannels,
} from '../shared/contracts/exileDiaryApi';

const logActions = new Set<ExileDiaryLogAction>([
  sendChannels.reloadApp,
  sendChannels.downloadUpdate,
  sendChannels.applyUpdate,
]);

const onRendererEvent = <K extends ExileDiaryRendererEventName>(
  eventName: K,
  listener: ExileDiaryListener<K>
) => {
  const channel = rendererEventChannels[eventName];
  const wrappedListener = (_event: unknown, payload: unknown) => {
    listener(payload as Parameters<ExileDiaryListener<K>>[0]);
  };

  ipcRenderer.on(channel, wrappedListener);

  return () => {
    ipcRenderer.removeListener(channel, wrappedListener);
  };
};

const api: ExileDiaryApi = {
  getAppGlobals: () => ipcRenderer.invoke(invokeChannels.getAppGlobals),
  loadRuns: (size) => ipcRenderer.invoke(invokeChannels.loadRuns, { size }),
  loadRun: (runId) => ipcRenderer.invoke(invokeChannels.loadRun, { runId }),
  loadRunDetails: (runId) => ipcRenderer.invoke(invokeChannels.loadRunDetails, { runId }),
  reprocessRuns: () => ipcRenderer.invoke(invokeChannels.reprocessRuns),
  reprocessRun: (runId) => ipcRenderer.invoke(invokeChannels.reprocessRun, { runId }),
  getSettings: (keys = []) => ipcRenderer.invoke(invokeChannels.getSettings, keys),
  getCharacters: () => ipcRenderer.invoke(invokeChannels.getCharacters),
  saveSettings: (settings) => ipcRenderer.invoke(invokeChannels.saveSettings, { settings }),
  getOAuthInfo: () => ipcRenderer.invoke(invokeChannels.getOAuthInfo),
  isAuthenticated: () => ipcRenderer.invoke(invokeChannels.isAuthenticated),
  logout: () => ipcRenderer.invoke(invokeChannels.logout),
  getAllStats: (params) => ipcRenderer.invoke(invokeChannels.getAllStats, params),
  getStashTabs: () => ipcRenderer.invoke(invokeChannels.getStashTabs),
  saveStashTabs: (stashTabs) => ipcRenderer.invoke(invokeChannels.saveStashTabs, { stashTabs }),
  saveStashRefreshInterval: (interval) =>
    ipcRenderer.invoke(invokeChannels.saveStashRefreshInterval, { interval }),
  saveFilterSettings: (filters) => ipcRenderer.invoke(invokeChannels.saveFilterSettings, filters),
  triggerSearch: (params) => ipcRenderer.invoke(invokeChannels.triggerSearch, params),
  getDivinePrice: () => ipcRenderer.invoke(invokeChannels.getDivinePrice),
  getAllMapNames: () => ipcRenderer.invoke(invokeChannels.getAllMapNames),
  getAllPossibleMods: () => ipcRenderer.invoke(invokeChannels.getAllPossibleMods),
  refreshProfitPerHour: () => ipcRenderer.invoke(invokeChannels.refreshProfitPerHour),
  debugRecheckGain: (from, to) => ipcRenderer.invoke(invokeChannels.debugRecheckGain, { from, to }),
  debugFetchRates: () => ipcRenderer.invoke(invokeChannels.debugFetchRates),
  debugFetchStashTabs: () => ipcRenderer.invoke(invokeChannels.debugFetchStashTabs),
  getOverlayPersistence: async () =>
    Boolean(await ipcRenderer.invoke(invokeChannels.getOverlayPersistence)),
  getOverlayPosition: async () => {
    const position = await ipcRenderer.invoke(invokeChannels.getOverlayPosition);
    return position ?? { x: 0, y: 0 };
  },
  updateItemsIgnoreStatus: (data) =>
    ipcRenderer.invoke(invokeChannels.updateItemsIgnoreStatus, { data }),
  listStrategies: () => ipcRenderer.invoke(invokeChannels.listStrategies),
  createStrategy: (input) => ipcRenderer.invoke(invokeChannels.createStrategy, { input }),
  updateStrategy: (strategyId, input) =>
    ipcRenderer.invoke(invokeChannels.updateStrategy, { strategyId, input }),
  deleteStrategy: (strategyId) => ipcRenderer.invoke(invokeChannels.deleteStrategy, { strategyId }),
  setRunStrategies: (runId, strategyIds) =>
    ipcRenderer.invoke(invokeChannels.setRunStrategies, { runId, strategyIds }),
  getStrategyStats: (strategyId) =>
    ipcRenderer.invoke(invokeChannels.getStrategyStats, { strategyId }),
  getPricesCatalog: (options) => ipcRenderer.invoke(invokeChannels.getPricesCatalog, { options }),
  getItemPriceDetails: (itemIdentifier, league) =>
    ipcRenderer.invoke(invokeChannels.getItemPriceDetails, { itemIdentifier, league }),
  addPriceOverride: (params) => ipcRenderer.invoke(invokeChannels.addPriceOverride, { params }),
  deletePriceOverride: (id, league) =>
    ipcRenderer.invoke(invokeChannels.deletePriceOverride, { id, league }),
  recalculatePrices: (from, to) =>
    ipcRenderer.invoke(invokeChannels.recalculatePrices, { from, to }),
  openFileDialog: (options) => ipcRenderer.invoke(invokeChannels.openFileDialog, options),
  showCharacterDbFile: () => ipcRenderer.invoke(invokeChannels.showCharacterDbFile),
  refreshUi: () => ipcRenderer.send(sendChannels.refreshUi),
  notifyFiltersUiUpdated: () => ipcRenderer.send(sendChannels.notifyFiltersUiUpdated),
  requestNetWorthRefresh: () => ipcRenderer.send(sendChannels.requestNetWorthRefresh),
  setOverlayClickable: (clickable) =>
    ipcRenderer.send(sendChannels.setOverlayClickable, { clickable }),
  setOverlayPosition: (position) => ipcRenderer.send(sendChannels.setOverlayPosition, position),
  disableHotkeys: () => ipcRenderer.send(sendChannels.disableHotkeys),
  enableHotkeys: () => ipcRenderer.send(sendChannels.enableHotkeys),
  triggerLogAction: (action) => {
    if (logActions.has(action)) {
      ipcRenderer.send(action);
    }
  },
  logRendererMessage: (payload) => ipcRenderer.send(sendChannels.rendererLog, payload),
  openExternal: (url) => shell.openExternal(url),
  on: onRendererEvent,
};

window.addEventListener(
  rendererBootEvent,
  () => {
    ipcRenderer.send(sendChannels.appBooted);
  },
  { once: true }
);

contextBridge.exposeInMainWorld('exileDiary', api);
