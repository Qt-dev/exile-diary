import { RendererAppService } from './services/RendererAppService';

const Responder = {
  getAppGlobals: async () => RendererAppService.getAppGlobals(),
  loadRuns: async (e, { size }) => RendererAppService.loadRuns(size),
  loadRun: async (e, { runId }) => RendererAppService.loadRun(runId),
  loadRunDetails: async (e, { runId }) => RendererAppService.loadRunDetails(runId),
  reprocessRuns: async () => RendererAppService.reprocessRuns(),
  reprocessRun: async (e, { runId }) => RendererAppService.reprocessRun(runId),
  getSettings: async (e, params = []) => RendererAppService.getSettings(params),
  getCharacters: async () => RendererAppService.getCharacters(),
  saveSettings: async (e, { settings }) => RendererAppService.saveSettings(settings),
  saveStashTabs: async (e, { stashTabs }) => RendererAppService.saveStashTabs(stashTabs),
  saveStashRefreshInterval: async (e, { interval }) =>
    RendererAppService.saveStashRefreshInterval(interval),
  saveFilterSettings: async (e, params) => RendererAppService.saveFilterSettings(params),
  getOAuthInfo: async () => RendererAppService.getOAuthInfo(),
  isAuthenticated: async () => RendererAppService.isAuthenticated(),
  logout: async () => RendererAppService.logout(),
  getOverlayPersistence: async () => RendererAppService.getOverlayPersistence(),
  getAllStats: async (e, params) => RendererAppService.getAllStats(params),
  getStashTabs: async () => RendererAppService.getStashTabs(),
  triggerSearch: async (e, params) => RendererAppService.triggerSearch(params),
  getDivinePrice: async () => RendererAppService.getDivinePrice(),
  getAllMapNames: async () => RendererAppService.getAllMapNames(),
  getAllPossibleMods: async () => RendererAppService.getAllPossibleMods(),
  refreshProfitPerHour: async () => RendererAppService.refreshProfitPerHour(),
  debugRecheckGain: async (e, { from, to }) => RendererAppService.debugRecheckGain(from, to),
  debugFetchRates: async () => RendererAppService.debugFetchRates(),
  debugFetchStashTabs: async () => RendererAppService.debugFetchStashTabs(),
  updateItemsIgnoreStatus: async (e, { data }) => RendererAppService.updateItemsIgnoreStatus(data),
  listStrategies: async () => RendererAppService.listStrategies(),
  createStrategy: async (e, { input }) => RendererAppService.createStrategy(input),
  updateStrategy: async (e, { strategyId, input }) =>
    RendererAppService.updateStrategy(strategyId, input),
  deleteStrategy: async (e, { strategyId }) => RendererAppService.deleteStrategy(strategyId),
  setRunStrategies: async (e, { runId, strategyIds }) =>
    RendererAppService.setRunStrategies(runId, strategyIds),
  getStrategyStats: async (e, { strategyId }) => RendererAppService.getStrategyStats(strategyId),
  getPricesCatalog: async (e, { options }: { options?: any } = {}) =>
    RendererAppService.getPricesCatalog(options),
  getItemPriceDetails: async (
    e,
    { itemIdentifier, league }: { itemIdentifier: string; league?: string }
  ) => RendererAppService.getItemPriceDetails(itemIdentifier, league),
  addPriceOverride: async (e, { params }: { params: any }) =>
    RendererAppService.addPriceOverride(params),
  deletePriceOverride: async (e, { id, league }: { id: number; league?: string }) =>
    RendererAppService.deletePriceOverride(id, league),
  recalculatePrices: async (
    e,
    { from, to }: { from?: string; to?: string } = {}
  ) => RendererAppService.recalculatePrices(from, to),
};

export default Responder;
