import logger from 'electron-log';
import * as path from 'path';
import * as fs from 'fs/promises';
import { app } from 'electron';
import DB from './db';

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

class SettingsManager {
  settings: any;
  saveScheduler: NodeJS.Timeout | null = null;

  constructor() {
    this.settings = {};
  }

  async initialize() {
    logger.info('Initializing Settings Manager');
    if (!fs.stat(settingsPath)) {
      logger.info('Initializing settings.json');
      await fs.unlink(settingsPath);
      await fs.writeFile(settingsPath, JSON.stringify({}));
    }
    this.settings = require(path.join(app.getPath('userData'), 'settings.json'));
  }

  getAll() {
    return this.settings;
  }

  get(settingKey) {
    return this.settings[settingKey];
  }

  async set(key, value) {
    if (key !== 'mainWindowBounds') logger.info(`Set "${key}" to ${JSON.stringify(value)}`);
    if (
      key === 'activeProfile' &&
      value.characterName && this.settings.activeProfile &&
      value.characterName !== this.settings.activeProfile.characterName) await DB.initDB(value.characterName);
    this.settings[key] = value;
    this.scheduleSave();
  }

  scheduleSave() {
    logger.info('Scheduling settings save');
    if (this.saveScheduler) clearTimeout(this.saveScheduler);

    this.saveScheduler = setTimeout(() => {
      this.save();
    }, 2000);
  }

  async save() {
    const tempFilePath = path.join(app.getPath('userData'), 'settings.json.bak');
    logger.info(`Saving settings to ${tempFilePath}`);
    await fs.writeFile(tempFilePath, JSON.stringify(this.settings));
    logger.info(`Renaming ${tempFilePath} into  ${settingsPath}`);
    await fs.rename(tempFilePath, settingsPath);
  }
}

const manager = new SettingsManager();

export default manager;
