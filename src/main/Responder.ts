import logger from 'electron-log';
import { app } from 'electron';
import Runs from './db/run';
import SettingsManager from './SettingsManager';
import GGGAPI from './GGGAPI';
import AuthManager from './AuthManager';
import StatsManager from './StatsManager';
import StashTabsManager from './StashTabsManager';
import stashGetter from './modules/StashGetter';
import RendererLogger from './RendererLogger';
import * as ClientTxtWatcher from './modules/ClientTxtWatcher';

const getAppGlobals = async () => {
  logger.info('Loading global settings for the renderer process');
  const appPath = __dirname;
  const appLocale = app.getLocale();
  const appVersion = app.getVersion();

  return {
    appPath,
    appLocale,
    appVersion,
  };
};

const loadRuns = async (e, { size }) => {
  logger.info(`Loading ${size} runs from the main process`);
  return await Runs.getLastRuns(size);
};

const loadRun = async (e, { runId }) => {
  logger.info(`Loading a single run with id: ${runId}`);
  const run = await Runs.getRun(runId);
  return run;
};

const loadRunDetails = async (e, { runId }) => {
  logger.info(`Loading details for run with id: ${runId}`);
  const run = await Runs.getRun(runId);
  return run;
};

const getSettings = async (e, params = []) => {
  logger.info('Loading settings for the renderer process');
  if (params.length === 0) return SettingsManager.settings;
  const settings: any = {};
  for (const param of params) {
    settings[param] = SettingsManager.settings[param];
  }
  return settings;
};

const getCharacters = async (e) => {
  logger.info('Getting all characters for the renderer process');
  const characters = await GGGAPI.getAllCharacters();
  return characters;
};

const saveSettings = async (e, { settings }) => {
  logger.info('Saving settings from the renderer process', settings);
  if (settings.clientTxt) {
    ClientTxtWatcher.checkValidLogfile(settings.clientTxt);
  }
  for (const key in settings) {
    await SettingsManager.set(key, settings[key]);
  }
  RendererLogger.log({ messages: [{ text: 'Settings saved' }] });
  return;
};

const getAuthInfo = async (e) => {
  logger.info('Getting code info for the renderer process');
  const info = AuthManager.getAuthInfo();
  return info;
};

const isAuthenticated = async (e) => {
  logger.info('Checking if user is authenticated for the renderer process');
  const authenticated = await AuthManager.isAuthenticated();
  return authenticated;
};

const logout = async (e) => {
  logger.info('Logging out the user after call from the renderer process');
  await AuthManager.logout();
  return;
};

const getAllStats = async (e, params) => {
  logger.info('Getting all stats for the renderer process');
  const profile = SettingsManager.get('activeProfile');
  const league = params?.league ?? profile.league;
  const characterName = params?.characterName ?? profile.characterName;
  const stats = StatsManager.getAllStats({ league, characterName });
  return stats;
};

const getStashTabs = async (e, params) => {
  logger.info('Getting all stashes for the renderer process');
  const activeProfile = SettingsManager.get('activeProfile');
  if (!activeProfile || !activeProfile.league) return { stashTabs: [], data: {} };
  const league = activeProfile.league;
  const trackedStashTabs = SettingsManager.get('trackedStashTabs');
  const trackedTabsIds =
    trackedStashTabs && trackedStashTabs[league] ? trackedStashTabs[league] : [];
  const stashTabs = (await GGGAPI.getAllStashTabs()).map((stash) => {
    if (stash.children) {
      stash.children = stash.children.map((child) => {
        return { ...child, tracked: trackedTabsIds.includes(child.id) };
      });
    }
    return { ...stash, tracked: trackedTabsIds.includes(stash.id) };
  });
  const stashData = await StashTabsManager.getStashData();
  return { stashTabs, data: stashData };
};

const saveStashTabs = async (e, params) => {
  logger.info('Saving stash info from the renderer process');
  const { stashTabs } = params;
  let allTrackedTabs = SettingsManager.get('trackedStashTabs')
    ? SettingsManager.get('trackedStashTabs')
    : {};
  const league = SettingsManager.get('activeProfile').league;
  allTrackedTabs[league] = stashTabs
    .sort()
    .filter((stashTab, index) => stashTabs.indexOf(stashTab) === index)
    .map((stashTab) => stashTab.id);
  SettingsManager.set('trackedStashTabs', allTrackedTabs);
};

const saveStashRefreshInterval = async (e, params) => {
  logger.info('Saving stash refresh interval from the renderer process');
  const { interval } = params;
  SettingsManager.set('netWorthCheck', { interval });
  stashGetter.refreshInterval();
};

const Responder = {
  'app-globals': getAppGlobals,
  'load-runs': loadRuns,
  'load-run': loadRun,
  'load-run-details': loadRunDetails,
  'get-settings': getSettings,
  'get-characters': getCharacters,
  'save-settings': saveSettings,
  'save-settings:stashtabs': saveStashTabs,
  'save-settings:stash-refresh-interval': saveStashRefreshInterval,
  'oauth:get-info': getAuthInfo,
  'oauth:is-authenticated': isAuthenticated,
  'oauth:logout': logout,
  'get-all-stats': getAllStats,
  'get-stash-tabs': getStashTabs,
};

export default Responder;
