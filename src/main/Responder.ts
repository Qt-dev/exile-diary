import logger from 'electron-log';
import { app } from 'electron';
import Runs from './db/run';
import SettingsManager from './SettingsManager';
import GGGAPI from './GGGAPI';
import AuthManager from './AuthManager';
import StatsManager from './StatsManager';

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
  for (const key in settings) {
    await SettingsManager.set(key, settings[key]);
  }
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
  const stashes = await GGGAPI.getAllStashTabs();
  return stashes;
};

const Responder = {
  'app-globals': getAppGlobals,
  'load-runs': loadRuns,
  'load-run': loadRun,
  'load-run-details': loadRunDetails,
  'get-settings': getSettings,
  'get-characters': getCharacters,
  'save-settings': saveSettings,
  'oauth:get-info': getAuthInfo,
  'oauth:is-authenticated': isAuthenticated,
  'oauth:logout': logout,
  'get-all-stats': getAllStats,
  'get-stash-tabs': getStashTabs,
};

export default Responder;
