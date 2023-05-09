import logger from 'electron-log';
import { app } from 'electron';
import Runs from './db/run';
import SettingsManager from './SettingsManager';
import GGGAPI from './GGGAPI';

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

const Responder = {
  'app-globals': getAppGlobals,
  'load-runs': loadRuns,
  'load-run': loadRun,
  'load-run-details': loadRunDetails,
  'get-settings': getSettings,
  'get-characters': getCharacters,
  'save-settings': saveSettings,
};

export default Responder;
