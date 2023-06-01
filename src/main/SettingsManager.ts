import logger from 'electron-log';
import * as path from 'path';
import * as fs from 'fs/promises';
import { app } from 'electron';
import DB from './db';
import GGGAPI from './GGGAPI';
import RateGetterV2 from './modules/RateGetterV2';

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

class SettingsManager {
  settings: any;
  saveScheduler: NodeJS.Timeout | null = null;

  constructor() {
    this.settings = {};
  }

  async initialize() {
    logger.info('Initializing Settings Manager');
    try {
      await fs.stat(settingsPath);
    } catch (e) {
      logger.info('Initializing settings.json');
      await fs.writeFile(settingsPath, JSON.stringify({}));
    }
    this.settings = require(path.join(app.getPath('userData'), 'settings.json'));
  }

  async initializeDB(characterName: string) {
    logger.info(`Initializing DB for ${characterName}`);
    const character = await this.getCharacter(characterName);
    await DB.initDB(character.name);
    await DB.initLeagueDB(character.league, character.name);
    await RateGetterV2.Getter.update();
  }

  async getCharacter(name: string | null = null) {
    let character;
    if(this.needsActiveProfile()) {
      logger.info('Getting character and league info');
      if(!name) {
        character = await GGGAPI.getCurrentCharacter();
      } else {
        character = (await GGGAPI.getAllCharacters()).find(
          (character) => character.name === name
        );
      }
      this.set('activeProfile', {
        characterName: character.name,
        league: character.league,
        valid: true,
      });
    } else {
      logger.info('Using active profile for character and league info');
      character = {
        league: this.settings.activeProfile.league,
        name: this.settings.activeProfile.characterName,
      };
    }
    return character;
  }

  getAll() {
    return this.settings;
  }

  get(settingKey) {
    return this.settings[settingKey];
  }

  async set(key, value) {
    if (key !== 'mainWindowBounds' && key !== 'poesessid')
      logger.info(`Set "${key}" to ${JSON.stringify(value)}`);
    if (key === 'poesessid') logger.info(`Set ${key}`);
    if (
      key === 'activeProfile' &&
      value.characterName &&
      !!(
        this.settings.activeProfile || // First active Profile
        (this.settings.activeProfile && // New active Profile
          value.characterName !== this.settings.activeProfile.characterName)
      )
    )
      await this.initializeDB(value.characterName);
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

  async delete(key) {
    logger.info(`Deleting ${key} from settings`);
    delete this.settings[key];
    await this.save();
  }

  needsActiveProfile() {
    return !this.settings.activeProfile?.characterName;
  }
}

const manager = new SettingsManager();

export default manager;
