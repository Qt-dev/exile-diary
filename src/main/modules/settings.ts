import logger from 'electron-log';
import path from 'path';
import fs from 'fs';
import { getUserDataPath } from '../runtime/getUserDataPath';

function readSettingsFile(settingsPath: string) {
  if (!fs.existsSync(settingsPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
}

let tempSettingsFileCounter = 0;

function getTempFilePath() {
  tempSettingsFileCounter += 1;
  return path.join(getUserDataPath(), `settings.${process.pid}.${tempSettingsFileCounter}.json.tmp`);
}

export function get() {
  try {
    return readSettingsFile(path.join(getUserDataPath(), 'settings.json'));
  } catch (err) {
    logger.info(err);
    logger.info('Unable to load settings.json');
    return null;
  }
}

export function set(key: string, value: any) {
  const settingsPath = path.join(getUserDataPath(), 'settings.json');
  if (!fs.existsSync(settingsPath)) {
    return;
  }

  const settings = readSettingsFile(settingsPath);
  if (!settings) {
    return;
  }

  settings[key] = value;
  const tempFilePath = getTempFilePath();
  fs.writeFile(tempFilePath, JSON.stringify(settings), (err) => {
    if (err) {
      logger.info(`Error writing temp settings file: ${err.message}`);
      return;
    }

    logger.info(`Renaming ${settingsPath}`);
    fs.rename(tempFilePath, settingsPath, (renameErr) => {
      if (renameErr) {
        logger.info(`Error copying temp settings file: ${renameErr.message}`);
      } else if (key !== 'mainWindowBounds') {
        logger.info(`Set "${key}" to ${JSON.stringify(value)}`);
      }
    });
  });
}

export default {
  get,
  set,
};
