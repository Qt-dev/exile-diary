import logger from 'electron-log';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ipcMain } from 'electron';
import DB from './db';
import GGGAPI from './GGGAPI';
import RateGetterV2 from './modules/RateGetterV2';
import EventEmitter from 'events';
import { getUserDataPath } from './runtime/getUserDataPath';
import { authSessionReadiness } from './auth/AuthSessionReadiness';

function getSettingsPath() {
  return path.join(getUserDataPath(), 'settings.json');
}

let tempSettingsFileCounter = 0;

function getTempSettingsPath() {
  tempSettingsFileCounter += 1;
  return path.join(getUserDataPath(), `settings.${process.pid}.${tempSettingsFileCounter}.json.tmp`);
}

function hasValidActiveProfile(activeProfile: any) {
  return !!(
    activeProfile &&
    activeProfile.characterName &&
    activeProfile.league &&
    activeProfile.valid
  );
}

const DefaultSettings = {
  activeProfile: {
    characterName: null,
    league: null,
    leagueOverride: null,
    valid: false,
  },
  alternateSplinterPricing: true,
  enableIncubatorAlert: false,
  clientTxt: null,
  screenshotDir: null,
  overlayEnabled: true,
  overlayPersistenceEnabled: true,
  forceDebugMode: false,
  logToUI: false,
  enableAutoscroll: true,
  screenshots: {
    allowCustomShortcut: true,
    allowFolderWatch: false,
    screenshotDir: null,
  },
  netWorthCheck: {
    interval: 500,
  },
  overlayPosition: {
    x: 0,
    y: 0,
  },
  trackedStashTabs: {},
  filters: {
    minimumValue: 0,
    filterPatterns: [],
    perCategory: {},
  },
  runParseScreenshotEnabled: true,
  runParseShortcut: 'CommandOrControl+F10',
  screenshotShortcut: 'CommandOrControl+F8',
  overlayToggleShortcut: 'CommandOrControl+F7',
  overlayMovementShortcut: 'CommandOrControl+F9',
  autoScreenshotOnMapEntry: {
    enabled: false,
    delay: 2,
  },
};

class SettingsManager {
  settings: any;
  saveScheduler: NodeJS.Timeout | null = null;
  databaseInitializationPromise: Promise<void> | null = null;
  eventEmitter = new EventEmitter();
  eventKeyMatcher: {
    [key: string]: {
      callback: Function;
    };
  } = {};

  constructor() {
    this.settings = {};
  }

  async initialize() {
    logger.info('Initializing Settings Manager');
    const settingsPath = getSettingsPath();
    try {
      await fs.stat(settingsPath);
    } catch (e) {
      logger.info('Initializing settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(DefaultSettings));
    }

    this.settings = {
      ...DefaultSettings,
      ...JSON.parse(await fs.readFile(settingsPath, 'utf8')),
    };
    authSessionReadiness.setProfileReady(hasValidActiveProfile(this.settings.activeProfile));

    this.scheduleSave();

    this.eventEmitter.on('change', (changedKey, value) => {
      const match = this.eventKeyMatcher[changedKey];
      if (match) match.callback(value, this.settings[changedKey]);
    });
  }

  async initializeDB(characterName: string) {
    if (this.databaseInitializationPromise) {
      return this.databaseInitializationPromise;
    }

    this.databaseInitializationPromise = (async () => {
      logger.info(`Initializing DB for ${characterName}`);
      const character = await this.getCharacter(characterName);
      await DB.initDB(character.name);
      await DB.initLeagueDB(character.league, character.name);
      void RateGetterV2.update().catch((error) => {
        logger.warn(`Background rate refresh failed after initializing ${character.name}`, error);
      });
    })();

    try {
      await this.databaseInitializationPromise;
    } finally {
      this.databaseInitializationPromise = null;
    }
  }

  async getCharacter(name: string | null = null) {
    let character;
    if (name) {
      logger.info(`Getting character and league info for explicit character ${name}`);
      character = (await GGGAPI.getAllCharacters()).find((character) => character.name === name);
      if (!character) {
        throw new Error(`Unable to resolve explicit character ${name}`);
      }
      this.settings.activeProfile = {
        characterName: character.name,
        league: character.league,
        valid: true,
      };
      authSessionReadiness.setProfileReady(true);
    } else if (this.needsActiveProfile()) {
      logger.info('Getting character and league info');
      character = await GGGAPI.getCurrentCharacter();
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
    return JSON.parse(JSON.stringify(this.settings));
  }

  get(settingKey) {
    return this.settings[settingKey] !== undefined
      ? JSON.parse(JSON.stringify(this.settings[settingKey]))
      : null;
  }

  async set(key: string, value: any) {
    if (key !== 'mainWindowBounds' && key !== 'poesessid')
      logger.info(`Set "${key}" to ${JSON.stringify(value)}`);
    if (key === 'poesessid') logger.info(`Set ${key}`);
    const previousValue = this.settings[key];
    this.settings[key] = value;
    if (key === 'activeProfile') {
      authSessionReadiness.setProfileReady(hasValidActiveProfile(value));
    }
    if (
      key === 'activeProfile' &&
      value.characterName &&
      !!(
        this.settings.activeProfile || // First active Profile
        (this.settings.activeProfile && // New active Profile
          value.characterName !== this.settings.activeProfile.characterName)
      )
      )
      void this.initializeDB(value.characterName).catch((error) => {
        logger.warn(`Background DB initialization failed for ${value.characterName}`, error);
      });
    this.eventEmitter.emit('change', key, value, previousValue);
    this.scheduleSave();

    if (key === 'enableAutoscroll') {
      ipcMain.emit('settings:autoscroll:updated', null, value);
    }
  }

  scheduleSave() {
    logger.info('Scheduling settings save');
    if (this.saveScheduler) clearTimeout(this.saveScheduler);

    this.saveScheduler = setTimeout(() => {
      void this.save().catch((error) => {
        logger.error('Error saving settings');
        logger.error(error);
      });
    }, 300);
  }

  async save() {
    const settingsPath = getSettingsPath();
    const tempFilePath = getTempSettingsPath();
    try {
      logger.info(`Saving settings to ${tempFilePath}`);
      await fs.writeFile(tempFilePath, JSON.stringify(this.settings));
      logger.info(`Renaming ${tempFilePath} into  ${settingsPath}`);
      await fs.rename(tempFilePath, settingsPath);
      this.eventEmitter.emit('saved');
    } finally {
      if (this.saveScheduler) clearTimeout(this.saveScheduler);
      this.saveScheduler = null;
    }
  }

  async delete(key) {
    logger.info(`Deleting ${key} from settings`);
    delete this.settings[key];
    if (key === 'activeProfile') {
      authSessionReadiness.setProfileReady(false);
    }
    await this.save();
  }

  needsActiveProfile() {
    return !this.settings.activeProfile?.characterName;
  }

  registerListener(key: string, callback: Function) {
    this.eventKeyMatcher[key] = { callback };
  }
  unregisterListener(key: string) {
    delete this.eventKeyMatcher[key];
  }

  waitForSave() {
    return new Promise((resolve) => {
      if (!this.saveScheduler) {
        resolve(null);
      } else {
        this.eventEmitter.once('saved', resolve);
      }
    });
  }
}

const manager = new SettingsManager();

export default manager;
