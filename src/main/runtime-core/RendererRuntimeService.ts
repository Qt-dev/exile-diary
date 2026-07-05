import dayjs from 'dayjs';
import logger from 'electron-log';
import Runs from '../db/repositories/run';
import SettingsManager from '../SettingsManager';
import GGGAPI from '../GGGAPI';
import AuthManager from '../AuthManager';
import StatsManager from '../StatsManager';
import StashTabsManager from '../StashTabsManager';
import stashGetter from '../modules/StashGetter';
import RendererLogger from '../RendererLogger';
import * as ClientTxtWatcher from '../modules/ClientTxtWatcher';
import ItemPricer from '../modules/ItemPricer';
import RunParser from '../modules/RunParser';
import SearchManager from '../SearchManager';
import RateGetterV2 from '../modules/RateGetterV2';
import ItemsDB from '../db/repositories/items';

type RendererRuntimeDependencies = {
  runs: {
    getLastRuns: (size: number) => Promise<any[]>;
    getRun: (runId: number) => Promise<any>;
  };
  settingsManager: {
    get: (key: string) => any;
    getAll: () => any;
    set: (key: string, value: any) => Promise<void>;
  };
  gggApi: {
    getAllCharacters: () => Promise<any[]>;
    getAllStashTabs: () => Promise<any[]>;
  };
  authManager: {
    getAuthInfo: () => Promise<{ code_challenge: string; state: string }>;
    isAuthenticated: () => Promise<boolean>;
    logout: () => Promise<void>;
  };
  statsManager: {
    getAllStats: (params: { league?: string; characterName?: string }) => Promise<any>;
    getAllMapNames: () => Promise<string[]>;
    getAllPossibleMods: () => Promise<string[]>;
    triggerProfitPerHourAnnouncer: () => void;
  };
  stashTabsManager: {
    getStashData: () => Promise<any>;
    refresh: () => Promise<void>;
  };
  stashGetter: {
    refreshInterval: () => void;
  };
  rendererLogger: {
    log: (payload: { messages: Array<Record<string, any>> }) => void;
  };
  clientTxtWatcher: {
    checkValidLogfile: (path: string) => void;
  };
  itemPricer: {
    getCurrencyByName: (name: string, date?: string, league?: string) => Promise<number>;
  };
  runParser: {
    reprocessRuns: () => Promise<void>;
    reprocessRun: (runId: number) => Promise<any>;
    recheckGained: (from?: string, to?: string) => Promise<void>;
  };
  searchManager: {
    search: (params: Record<string, any>) => void;
  };
  rateGetter: {
    update: (force?: boolean) => Promise<void>;
  };
  itemsDb: {
    updateIgnoredItems: (data: Array<{ id: string; status: boolean }>) => Promise<void>;
  };
  now: () => string;
};

function createDefaultRendererRuntimeDependencies(): RendererRuntimeDependencies {
  return {
    runs: Runs,
    settingsManager: SettingsManager,
    gggApi: GGGAPI,
    authManager: AuthManager,
    statsManager: StatsManager,
    stashTabsManager: StashTabsManager,
    stashGetter,
    rendererLogger: RendererLogger,
    clientTxtWatcher: ClientTxtWatcher,
    itemPricer: ItemPricer,
    runParser: RunParser,
    searchManager: SearchManager,
    rateGetter: RateGetterV2,
    itemsDb: ItemsDB,
    now: () => dayjs().format('YYYYMMDD'),
  };
}

function pickSettings(allSettings: Record<string, any>, keys: string[]) {
  if (keys.length === 0) {
    return allSettings;
  }

  const selectedSettings: Record<string, any> = {};
  for (const key of keys) {
    selectedSettings[key] = allSettings[key];
  }
  return selectedSettings;
}

function getTrackedStashTabIds(stashTabs: Array<{ id: string }>) {
  return [...new Set(stashTabs.map((stashTab) => stashTab.id))].sort();
}

function markTrackedTabs(stashTabs: any[], trackedTabIds: string[]) {
  return stashTabs.map((stash) => ({
    ...stash,
    tracked: trackedTabIds.includes(stash.id),
    children: stash.children?.map((child) => ({
      ...child,
      tracked: trackedTabIds.includes(child.id),
    })),
  }));
}

export function createRendererRuntimeService(
  deps: RendererRuntimeDependencies = createDefaultRendererRuntimeDependencies()
) {
  return {
    async loadRuns(size: number) {
      logger.info(
        `Loading ${size === Number.MAX_SAFE_INTEGER ? 'all' : size} runs from runtime-core`
      );
      return deps.runs.getLastRuns(size);
    },

    async loadRun(runId: string | number) {
      logger.info(`Loading a single run with id: ${runId}`);
      return deps.runs.getRun(Number(runId));
    },

    async loadRunDetails(runId: string | number) {
      logger.info(`Loading details for run with id: ${runId}`);
      return deps.runs.getRun(Number(runId));
    },

    async reprocessRuns() {
      logger.info('Reprocessing all runs');
      await deps.runParser.reprocessRuns();
      deps.rendererLogger.log({ messages: [{ text: 'All runs have been reprocessed.' }] });
    },

    async reprocessRun(runId: string | number) {
      logger.info(`Reprocessing run with id: ${runId}`);
      const numericRunId = Number(runId);
      await deps.runParser.reprocessRun(numericRunId);
      return deps.runs.getRun(numericRunId);
    },

    async getSettings(keys: string[] = []) {
      logger.info('Loading settings for the renderer process');
      return pickSettings(deps.settingsManager.getAll(), keys);
    },

    async getCharacters() {
      logger.info('Getting all characters for the renderer process');
      return deps.gggApi.getAllCharacters();
    },

    async saveSettings(settings: Record<string, any>) {
      logger.info('Saving settings from the renderer process', settings);
      if (settings.clientTxt) {
        deps.clientTxtWatcher.checkValidLogfile(settings.clientTxt);
      }

      for (const key in settings) {
        await deps.settingsManager.set(key, settings[key]);
      }

      deps.rendererLogger.log({ messages: [{ text: 'Settings saved' }] });
    },

    async getOAuthInfo() {
      logger.info('Getting code info for the renderer process');
      return deps.authManager.getAuthInfo();
    },

    async isAuthenticated() {
      logger.info('Checking if user is authenticated for the renderer process');
      return deps.authManager.isAuthenticated();
    },

    async logout() {
      logger.info('Logging out the user after call from the renderer process');
      await deps.authManager.logout();
    },

    async getAllStats(params?: { league?: string; characterName?: string }) {
      logger.info('Getting all stats for the renderer process');
      const profile = deps.settingsManager.get('activeProfile');
      const league = params?.league ?? profile?.league;
      const characterName = params?.characterName ?? profile?.characterName;
      const stats = await deps.statsManager.getAllStats({ league, characterName });
      stats.divinePrice = await deps.itemPricer.getCurrencyByName(
        'Divine Orb',
        deps.now(),
        league
      );
      return stats;
    },

    async getStashTabs() {
      logger.info('Getting all stashes for the renderer process');
      const activeProfile = deps.settingsManager.get('activeProfile');
      if (!activeProfile?.league) {
        return { stashTabs: [], data: {} };
      }

      const trackedStashTabs = deps.settingsManager.get('trackedStashTabs');
      const trackedTabIds = trackedStashTabs?.[activeProfile.league] ?? [];
      const stashTabs = markTrackedTabs(await deps.gggApi.getAllStashTabs(), trackedTabIds);
      const stashData = await deps.stashTabsManager.getStashData();
      return { stashTabs, data: stashData };
    },

    async saveStashTabs(stashTabs: Array<{ id: string }>) {
      logger.info('Saving stash info from the renderer process');
      const activeProfile = deps.settingsManager.get('activeProfile');
      if (!activeProfile?.league) {
        return;
      }

      const allTrackedTabs = deps.settingsManager.get('trackedStashTabs') || {};
      allTrackedTabs[activeProfile.league] = getTrackedStashTabIds(stashTabs);
      await deps.settingsManager.set('trackedStashTabs', allTrackedTabs);
    },

    async saveStashRefreshInterval(interval: number) {
      logger.info('Saving stash refresh interval from the renderer process');
      await deps.settingsManager.set('netWorthCheck', { interval });
      deps.stashGetter.refreshInterval();
    },

    async saveFilterSettings(filters: {
      minimumValue: number;
      filterPatterns: string[];
      perCategory: Record<string, any>;
    }) {
      logger.info('Saving filter settings from the renderer process');
      const { minimumValue, filterPatterns, perCategory } = filters;
      await deps.settingsManager.set('filters', { minimumValue, filterPatterns, perCategory });
      deps.rendererLogger.log({ messages: [{ text: 'Filter settings saved' }] });
    },

    async triggerSearch(params: Record<string, any>) {
      logger.info('Triggering search from the renderer process');
      deps.searchManager.search(params);
    },

    async getDivinePrice() {
      logger.info('Getting divine price from the renderer process');
      return deps.itemPricer.getCurrencyByName(
        'Divine Orb',
        deps.now(),
        deps.settingsManager.get('activeProfile')?.league
      );
    },

    async getAllMapNames() {
      logger.info('Getting all map names from the renderer process');
      return deps.statsManager.getAllMapNames();
    },

    async getAllPossibleMods() {
      logger.info('Getting all possible mods from the renderer process');
      return deps.statsManager.getAllPossibleMods();
    },

    async refreshProfitPerHour() {
      deps.statsManager.triggerProfitPerHourAnnouncer();
    },

    async debugRecheckGain(from?: string, to?: string) {
      logger.info('Debugging recheck gain from the renderer process');
      await deps.runParser.recheckGained(from, to);
    },

    async debugFetchRates() {
      logger.info('Fetching rates from the renderer process');
      await deps.rateGetter.update(true);
    },

    async debugFetchStashTabs() {
      logger.info('Fetching stash tabs from the renderer process');
      await deps.stashTabsManager.refresh();
    },

    async getOverlayPersistence() {
      logger.info('Fetching Overlay Persistence status for the overlay');
      return deps.settingsManager.get('overlayPersistenceEnabled');
    },

    async updateItemsIgnoreStatus(data: Array<{ id: string; status: boolean }>) {
      logger.info('Updating items ignore status from the renderer process');
      await deps.itemsDb.updateIgnoredItems(data);
    },
  };
}

export type RendererRuntimeService = ReturnType<typeof createRendererRuntimeService>;
