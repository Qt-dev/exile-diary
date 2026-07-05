import { access, constants, writeFile, rename } from 'fs/promises';
import Logger from 'electron-log';
import { getUserDataPath } from '../../runtime/getUserDataPath';

const path = require('path');
const logger = Logger.scope('db/settings');

function getSettingsPath() {
  return path.join(getUserDataPath(), 'settings.json');
}

function getTempFilePath() {
  return path.join(getUserDataPath(), 'settings.json.bak');
}

type Settings = {
  [key: string]: any;
};

export function get() {
  const settingsPath = getSettingsPath();
  let settings: Settings | null = null;
  try {
    settings = require(settingsPath) as Settings;
  } catch (err) {
    try {
      settings = JSON.parse(require('fs').readFileSync(settingsPath, 'utf8')) as Settings;
    } catch (readError) {
      logger.error(readError);
      logger.error('Unable to load settings.json');
    }
  }
  return settings;
}

export async function set(key: string, value: any) {
  const settingsPath = getSettingsPath();
  const tempFilePath = getTempFilePath();
  await access(settingsPath, constants.F_OK);
  const settings = get();
  if (!settings) {
    throw new Error('Unable to load settings.json');
  }
  settings[key] = value;
  try {
    await writeFile(tempFilePath, JSON.stringify(settings));
  } catch (error) {
    logger.error('Error writing temp settings file');
    logger.error(error);
  }

  try {
    await rename(tempFilePath, settingsPath);
  } catch (error) {
    logger.error('Error copying temp settings file');
    logger.error(error);
  }

  if (key !== 'mainWindowBounds') {
    logger.info(`Set "${key}" to ${JSON.stringify(value)}`);
  }
}

const dbSettings = {
  get,
  set,
};

export default dbSettings;
