import { access, constants, writeFile, rename } from 'fs/promises';
import { app } from 'electron';
import logger from 'electron-log';
const path = require('path');
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const tempFilePath = path.join(app.getPath('userData'), 'settings.json.bak');

type Settings = {
  [key: string]: any;
};

export function get() {
  let settings: Settings | null = null;
  try {
    settings = require(path.join(app.getPath('userData'), 'settings.json')) as Settings;
  } catch (err) {
    logger.error(err);
    logger.error('Unable to load settings.json');
    // do nothing if file doesn't exist
  }
  return settings;
}

export async function set(key: string, value: any) {
  await access(settingsPath, constants.F_OK);
  const settings = require(settingsPath) as Settings;
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

export default {
  get,
  set,
};
