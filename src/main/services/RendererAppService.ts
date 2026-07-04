import { app } from 'electron';
import logger from 'electron-log';
import dayjs from 'dayjs';
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

export const RendererAppService = {
  async getAppGlobals() {
    logger.info('Loading global settings for the renderer process');
    return {
      appPath: __dirname,
      appLocale: app.getLocale(),
      appVersion: app.getVersion(),
    };
  },

  async loadRuns(size: number) {
    logger.info(
      `Loading ${size === Number.MAX_SAFE_INTEGER ? 'all' : size} runs from the main process`
    );
    return Runs.getLastRuns(size);
  },

  async loadRun(runId: string | number) {
    logger.info(`Loading a single run with id: ${runId}`);
    return Runs.getRun(Number(runId));
  },

  async loadRunDetails(runId: string | number) {
    logger.info(`Loading details for run with id: ${runId}`);
    const run = await Runs.getRun(Number(runId));
    logger.info(run);
    return run;
  },

  async reprocessRuns() {
    logger.info('Reprocessing all runs');
    await RunParser.reprocessRuns();
    RendererLogger.log({ messages: [{ text: 'All runs have been reprocessed.' }] });
  },

  async reprocessRun(runId: string | number) {
    logger.info(`Reprocessing run with id: ${runId}`);
    const numericRunId = Number(runId);
    await RunParser.reprocessRun(numericRunId);
    return Runs.getRun(numericRunId);
  },

  async getSettings(keys: string[] = []) {
    logger.info('Loading settings for the renderer process');
    if (keys.length === 0) {
      return SettingsManager.settings;
    }

    const settings: Record<string, any> = {};
    for (const key of keys) {
      settings[key] = SettingsManager.settings[key];
    }
    return settings;
  },

  async getCharacters() {
    logger.info('Getting all characters for the renderer process');
    return GGGAPI.getAllCharacters();
  },

  async saveSettings(settings: Record<string, any>) {
    logger.info('Saving settings from the renderer process', settings);
    if (settings.clientTxt) {
      ClientTxtWatcher.checkValidLogfile(settings.clientTxt);
    }

    for (const key in settings) {
      await SettingsManager.set(key, settings[key]);
    }

    RendererLogger.log({ messages: [{ text: 'Settings saved' }] });
  },

  async getOAuthInfo() {
    logger.info('Getting code info for the renderer process');
    return AuthManager.getAuthInfo();
  },

  async isAuthenticated() {
    logger.info('Checking if user is authenticated for the renderer process');
    return AuthManager.isAuthenticated();
  },

  async logout() {
    logger.info('Logging out the user after call from the renderer process');
    await AuthManager.logout();
  },

  async getAllStats(params?: { league?: string; characterName?: string }) {
    logger.info('Getting all stats for the renderer process');
    const profile = SettingsManager.get('activeProfile');
    const league = params?.league ?? profile.league;
    const characterName = params?.characterName ?? profile.characterName;
    const stats = await StatsManager.getAllStats({ league, characterName });
    stats.divinePrice = await ItemPricer.getCurrencyByName(
      'Divine Orb',
      dayjs().format('YYYYMMDD'),
      league
    );
    return stats;
  },

  async getStashTabs() {
    logger.info('Getting all stashes for the renderer process');
    const activeProfile = SettingsManager.get('activeProfile');
    if (!activeProfile || !activeProfile.league) {
      return { stashTabs: [], data: {} };
    }

    const league = activeProfile.league;
    const trackedStashTabs = SettingsManager.get('trackedStashTabs');
    const trackedTabsIds =
      trackedStashTabs && trackedStashTabs[league] ? trackedStashTabs[league] : [];
    const stashTabs = (await GGGAPI.getAllStashTabs()).map((stash) => {
      if (stash.children) {
        stash.children = stash.children.map((child) => ({
          ...child,
          tracked: trackedTabsIds.includes(child.id),
        }));
      }

      return { ...stash, tracked: trackedTabsIds.includes(stash.id) };
    });
    const stashData = await StashTabsManager.getStashData();
    return { stashTabs, data: stashData };
  },

  async saveStashTabs(stashTabs: Array<{ id: string }>) {
    logger.info('Saving stash info from the renderer process');
    const allTrackedTabs = SettingsManager.get('trackedStashTabs') || {};
    const league = SettingsManager.get('activeProfile').league;
    allTrackedTabs[league] = stashTabs
      .sort()
      .filter((stashTab, index) => stashTabs.indexOf(stashTab) === index)
      .map((stashTab) => stashTab.id);
    await SettingsManager.set('trackedStashTabs', allTrackedTabs);
  },

  async saveStashRefreshInterval(interval: number) {
    logger.info('Saving stash refresh interval from the renderer process');
    await SettingsManager.set('netWorthCheck', { interval });
    stashGetter.refreshInterval();
  },

  async saveFilterSettings(filters: {
    minimumValue: number;
    filterPatterns: string[];
    perCategory: Record<string, any>;
  }) {
    logger.info('Saving filter settings from the renderer process');
    const { minimumValue, filterPatterns, perCategory } = filters;
    await SettingsManager.set('filters', { minimumValue, filterPatterns, perCategory });
    RendererLogger.log({ messages: [{ text: 'Filter settings saved' }] });
  },

  async triggerSearch(params: Record<string, any>) {
    logger.info('Triggering search from the renderer process');
    SearchManager.search(params);
  },

  async getDivinePrice() {
    logger.info('Getting divine price from the renderer process');
    return ItemPricer.getCurrencyByName(
      'Divine Orb',
      dayjs().format('YYYYMMDD'),
      SettingsManager.get('activeProfile').league
    );
  },

  async getAllMapNames() {
    logger.info('Getting all map names from the renderer process');
    return StatsManager.getAllMapNames();
  },

  async getAllPossibleMods() {
    logger.info('Getting all possible mods from the renderer process');
    return StatsManager.getAllPossibleMods();
  },

  async refreshProfitPerHour() {
    return StatsManager.triggerProfitPerHourAnnouncer();
  },

  async debugRecheckGain(from?: string, to?: string) {
    logger.info('Debugging recheck gain from the renderer process');
    await RunParser.recheckGained(from, to);
  },

  async debugFetchRates() {
    logger.info('Fetching rates from the renderer process');
    await RateGetterV2.update(true);
  },

  async debugFetchStashTabs() {
    logger.info('Fetching stash tabs from the renderer process');
    await StashTabsManager.refresh();
  },

  async getOverlayPersistence() {
    logger.info('Fetching Overlay Persistence status for the overlay');
    return SettingsManager.get('overlayPersistenceEnabled');
  },

  async updateItemsIgnoreStatus(data: Array<{ id: string; status: boolean }>) {
    logger.info('Updating items ignore status from the renderer process');
    await ItemsDB.updateIgnoredItems(data);
  },
};
