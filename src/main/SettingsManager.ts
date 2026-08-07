import logger from 'electron-log';
import * as path from 'path';
import * as fs from 'fs/promises';
import DB from './db';
import GGGAPI from './GGGAPI';
import PricingService from './pricing/PricingService';
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

function haveProfilesChanged(previousValue: any, nextValue: any) {
  return (
    previousValue?.characterName !== nextValue?.characterName ||
    previousValue?.league !== nextValue?.league
  );
}

type ActiveProfile = {
  characterName: string;
  league: string;
  valid?: boolean;
  [key: string]: unknown;
};

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
  inventoryCaptureShortcut: 'CommandOrControl+F11',
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
  lastSaveError: Error | null = null;
  profileTransitionQueue: Promise<void> = Promise.resolve();
  databaseInitializationPromises = new Map<string, Promise<void>>();
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

    await this.reload();

    this.eventEmitter.on('change', (changedKey, value, previousValue) => {
      const match = this.eventKeyMatcher[changedKey];
      if (match) match.callback(value, previousValue);
    });
  }

  async reload() {
    const settingsPath = getSettingsPath();
    this.settings = {
      ...DefaultSettings,
      ...JSON.parse(await fs.readFile(settingsPath, 'utf8')),
    };
    authSessionReadiness.setProfileReady(hasValidActiveProfile(this.settings.activeProfile));
  }

  private refreshRatesInBackground(profile: ActiveProfile) {
    void PricingService.update().catch((error) => {
      logger.warn(`Background rate refresh failed after initializing ${profile.characterName}`, error);
    });
  }

  async initializeDB(profile: ActiveProfile, refreshRates = true) {
    const key = `${profile.characterName}\u0000${profile.league}`;
    const existingInitialization = this.databaseInitializationPromises.get(key);
    if (existingInitialization) return existingInitialization;

    const initialization = (async () => {
      logger.info(`Initializing DB for ${profile.characterName} in ${profile.league}`);
      await DB.initDB(profile.characterName, profile.league);
      await DB.initLeagueDB(profile.league, profile.characterName);
      if (refreshRates) this.refreshRatesInBackground(profile);
    })();

    this.databaseInitializationPromises.set(key, initialization);

    try {
      await initialization;
    } finally {
      this.databaseInitializationPromises.delete(key);
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
    if (key === 'activeProfile') {
      const transition = this.profileTransitionQueue.catch(() => undefined).then(async () => {
        const previousValue = this.settings.activeProfile;
        const profileChanged = haveProfilesChanged(previousValue, value);

        if (hasValidActiveProfile(value) && profileChanged) {
          authSessionReadiness.setProfileReady(false);
          try {
            await this.initializeDB(value, false);
          } catch (error) {
            authSessionReadiness.setProfileReady(hasValidActiveProfile(previousValue));
            logger.error(`DB initialization failed for ${value.characterName}`, error);
            throw error;
          }
        }

        this.settings.activeProfile = value;
        authSessionReadiness.setProfileReady(hasValidActiveProfile(value));
        this.scheduleSave();
        this.eventEmitter.emit('change', key, value, previousValue);
      });
      this.profileTransitionQueue = transition;
      return transition;
    }

    const previousValue = this.settings[key];
    this.settings[key] = value;
    this.scheduleSave();
    this.eventEmitter.emit('change', key, value, previousValue);
  }

  scheduleSave() {
    logger.info('Scheduling settings save');
    this.lastSaveError = null;
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
      this.lastSaveError = null;
      this.eventEmitter.emit('saved');
    } catch (error) {
      this.lastSaveError = error instanceof Error ? error : new Error(String(error));
      this.eventEmitter.emit('save:error', this.lastSaveError);
      throw error;
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

  private waitForScheduledSave() {
    return new Promise<void>((resolve, reject) => {
      if (!this.saveScheduler) {
        if (this.lastSaveError) {
          const error = this.lastSaveError;
          this.lastSaveError = null;
          reject(error);
        } else {
          resolve();
        }
      } else {
        const onSaved = () => {
          this.eventEmitter.off('save:error', onError);
          resolve();
        };
        const onError = (error: Error) => {
          this.eventEmitter.off('saved', onSaved);
          reject(error);
        };
        this.eventEmitter.once('saved', onSaved);
        this.eventEmitter.once('save:error', onError);
      }
    });
  }

  async waitForSave() {
    while (true) {
      const transition = this.profileTransitionQueue;
      await transition;
      if (transition !== this.profileTransitionQueue) continue;

      await this.waitForScheduledSave();
      if (transition === this.profileTransitionQueue && !this.saveScheduler) return;
    }
  }
}

const manager = new SettingsManager();

export default manager;
