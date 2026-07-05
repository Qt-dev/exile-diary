import logger from 'electron-log';
import Axios from 'axios';
import { setupCache, buildMemoryStorage } from 'axios-cache-interceptor/dev';
import SettingsManager from './SettingsManager';
import AuthManager from './AuthManager';
import Bottleneck from 'bottleneck';
import { v4 as uuidv4 } from 'uuid';
import { getAppVersion } from './runtime/getUserDataPath';
const CACHE_TIME_IN_SECONDS = 10;
const MIN_TIME_BETWEEN_REQUESTS = 333; // 1 request per second as a default, will be adjusted based on API feedback
const instance = Axios.create();
const storage = buildMemoryStorage();
const debugLogger = typeof logger.info === 'function' ? logger.info.bind(logger) : undefined;
const axios = setupCache(instance, {
  enabled: true,
  ttl: 1000 * CACHE_TIME_IN_SECONDS, // DEFAULT: Cache for 10 seconds, can be overridden per request
  storage,
  interpretHeader: false,
  vary: false, // No reason to break cache by Vary headers since we control the requests
  debug: debugLogger,
});

type Inventory = {
  inventory: any[];
  equipment: any[];
  experience: number;
};

const limiters = new Bottleneck.Group({
  maxConcurrent: 1,
  minTime: MIN_TIME_BETWEEN_REQUESTS,
});

let currentlyRestrictedKeys = {};

/**
 * PARSER: Converts PoE's "1:5:0,10:60:0" format into an object
 */
const parsePoeHeader = (header) => {
  if (!header) return [];
  return header.split(',').map((rule) => {
    const [count, period, extra] = rule.split(':').map(Number);
    return { count, period, extra };
  });
};

/**
 * FEEDBACK LOOP: Update Bottleneck based on PoE headers
 */
const updateLimiterFromHeaders = (limiter, headers) => {
  logger.debug(
    `Updating rate limiter settings for ${limiter.id} based on API response headers`,
    headers
  );
  const rulesHeader = headers['x-rate-limit-rules'] || ''; // e.g., "client,ip"
  const rules = rulesHeader.split(',');

  rules.forEach((ruleName) => {
    const limitHeader = headers[`x-rate-limit-${ruleName}`];
    const stateHeader = headers[`x-rate-limit-${ruleName}-state`];

    const limits = parsePoeHeader(limitHeader);
    const states = parsePoeHeader(stateHeader);

    // If any state shows an active restriction (3rd number > 0)
    const isRestricted = states.some((s) => s.extra > 0);

    if (isRestricted) {
      const maxWait = Math.max(...states.map((s) => s.extra));
      logger.error(`!!! API Calls Restricted for ${ruleName} for ${maxWait} seconds !!!`);
      limiter.updateSettings({ minTime: maxWait * 1000 });
      // Reset minTime after the ban expires
      setTimeout(
        () => limiter.updateSettings({ minTime: MIN_TIME_BETWEEN_REQUESTS }),
        maxWait * 1000
      );
    }

    // Proactive: If we are at 90% of ANY limit, slow down
    limits.forEach((limit, i) => {
      const state = states[i];
      if (state.count / limit.count > 0.9) {
        logger.warn(
          `Nearing limit for ${ruleName}: ${state.count}/${limit.count} (${(
            (state.count / limit.count) *
            100
          ).toFixed(2)}%). Slowing down.`
        );
        limiter.updateSettings({ minTime: 2000 });
        // Reset minTime after a cooldown period
        setTimeout(
          () => limiter.updateSettings({ minTime: MIN_TIME_BETWEEN_REQUESTS }),
          limit.period * 1000
        );
      }
    });
  });
};

const handleFailure = (type: string, limiter) => async (error, jobInfo) => {
  logger.error(`Request ${jobInfo.options.id} failed (type: ${type}) with ${error.message}.`);

  if (error.status === 429) {
    currentlyRestrictedKeys[jobInfo.options.id] = true;
    const retryAfter = parseInt(error.response.headers['retry-after'], 10) || 30;
    logger.error(`Too many requests. Waiting ${retryAfter} seconds before retrying...`);
    limiter.updateSettings({ minTime: retryAfter * 1000 });
    // Reset minTime after the retry period
    setTimeout(() => {
      currentlyRestrictedKeys[jobInfo.options.id] = false;
      limiter.updateSettings({ minTime: MIN_TIME_BETWEEN_REQUESTS });
    }, retryAfter * 1000);

    return retryAfter * 1000;
  }
};

limiters.on('created', (limiter, key) => {
  logger.info(`Limiter created: ${limiter.id}. Setting up listeners for ${key} group.`);

  limiter.on('failed', handleFailure('failure', limiter));

  limiter.on('done', (jobInfo) => {
    logger.debug(`========Request ${jobInfo.options.id} done.`);
    logger.debug(jobInfo);
  });

  limiter.on('executing', async (jobInfo) => {
    logger.debug(`========Request ${jobInfo.options.id} started.`);
  });

  limiter.on('queued', (jobInfo) => {
    logger.debug(`========Request ${jobInfo.options.id} queued.`);
  });
});

const Endpoints = {
  characters: () => '/character',
  character: ({ characterName }) => `/character/${characterName}`,
  stashes: ({ league }) => `/stash/${league}`,
  stash: ({ league, stashId }) => `/stash/${league}/${stashId}`,
};

const adminEmail = 'quentin@devauchelle.com';

const getRequestParams = (url, token) => {
  return {
    baseURL: 'https://api.pathofexile.com',
    url,
    method: 'GET',
    headers: {
      'User-Agent': `OAuth exile-diary-reborn/${getAppVersion()} (contact: ${adminEmail})`,
      Authorization: `Bearer ${token}`,
    },
  };
};

const request = async ({ params, group, cacheTime = CACHE_TIME_IN_SECONDS, limiterId = group }) => {
  const limiter = limiters.key(limiterId);
  const scheduledId = `${group.replace('/', '')}-${uuidv4()}`;

  if (currentlyRestrictedKeys && currentlyRestrictedKeys[group]) {
    const cached = await storage.get(group);
    if (cached && cached.data) {
      logger.warn('⚠️ API Restricted: Serving STALE data from cache.');
      return cached.data;
    }
    // If not even in cache, we must throw or wait
    throw new Error('API Restricted and no cached data available.');
  }

  return limiter.schedule({ id: scheduledId }, async () => {
    logger.debug('Making request to GGG API', { url: params.url, group, params });
    if (!params.cache) {
      logger.debug('Adding cache to request for group', group);
      params.cache = {
        enabled: true,
        ttl: 1000 * cacheTime,
      };
    }
    const response = await new Promise<void>((resolve) => {
      logger.debug('Starting the Request Promise for', { url: params.url, group });
      resolve();
    })
      .then(() => axios({ ...params, id: group }))
      .then(async (response) => {
        if (response.cached) {
          logger.debug(`Response from cache for ${params.url}`);
        } else {
          logger.debug(`Response from API for ${params.url}`);
        }
        return response;
      });

    updateLimiterFromHeaders(limiter, response.headers);

    logger.debug('Request successfully completed for', { url: params.url, group });

    return response;
  });
};

const getSettings = async (needProfile = true) => {
  const { settings } = SettingsManager;
  const { username, activeProfile } = settings;
  if (!username) throw new Error('Missing username');
  if ((!activeProfile || !activeProfile.characterName) && needProfile)
    throw new Error('Missing Active Profile');
  const token = await AuthManager.getToken();
  return {
    username,
    characterName: activeProfile?.characterName,
    league: activeProfile?.league,
    token,
  };
};

const getAllCharacters = async () => {
  logger.info('Getting characters from the GGG API');
  try {
    const { username, token } = await getSettings(false);
    const response: any = await request({
      params: getRequestParams(Endpoints.characters(), token),
      group: `getAllCharacters-${username}`,
    });
    const characters = await response.data.characters;
    logger.info(`Found ${characters.length} characters from the GGG API for account: ${username}`);
    return characters;
  } catch (e: any) {
    logger.error(`Error while getting characters from the GGG API: ${e.message}`);
    return [];
  }
};

const getDataForInventory = async (): Promise<Inventory> => {
  logger.info('Getting inventory and XP data from the GGG API');
  try {
    const { characterName, token } = await getSettings();
    const response: any = await request({
      params: getRequestParams(Endpoints.character({ characterName }), token),
      group: `getDataForInventory-${characterName}`,
    });
    const character = await response.data.character;
    const { inventory: mainInventory, equipment, experience } = character;
    const rucksack = character.rucksack ?? [];
    const inventory = [...mainInventory, ...rucksack];
    logger.info(`Found inventory for character: ${characterName}`);
    return {
      inventory,
      equipment,
      experience,
    };
  } catch (e: any) {
    logger.error(`Error while getting inventory from the GGG API: ${e.message}`);
    return { inventory: [], equipment: [], experience: 0 };
  }
};

const getSkillTree = async () => {
  logger.info('Getting skill tree from the GGG API');
  try {
    const { characterName, token } = await getSettings();
    const response: any = await request({
      params: getRequestParams(Endpoints.character({ characterName }), token),
      group: `getSkillTree-${characterName}`,
    });
    const skillTree = await response.data.character.passives;
    logger.info(`Found skill tree for character: ${characterName}`);
    return skillTree;
  } catch (e: any) {
    logger.error(`Error while getting skill tree from the GGG API: ${e.message}`);
    return { hashes: [], jewel_data: {} };
  }
};

const getStashTab = async (stashId) => {
  logger.info('Getting stash from the GGG API');
  try {
    const { username, league, token } = await getSettings();
    const response: any = await request({
      params: getRequestParams(Endpoints.stash({ league, stashId }), token),
      group: `getStashTab-${stashId}`,
      limiterId: `getAllStashTabs-${username}`, // Use the same limiter as getAllStashTabs to avoid hitting rate limits when fetching multiple tabs
    });
    const stash = await response.data.stash;
    logger.info(`Found stash ${stashId} for account: ${username}`);
    return stash;
  } catch (e: any) {
    logger.error(`Error while getting stash from the GGG API: ${e.message}`);
    return { items: [] };
  }
};

const getAllStashTabs = async () => {
  logger.info('Getting stashes from the GGG API');
  try {
    const { username, league, token } = await getSettings();
    const response: any = await request({
      params: getRequestParams(Endpoints.stashes({ league }), token),
      group: `getAllStashTabs-${username}`,
    });
    const stashes = await response.data.stashes;
    logger.info(`Found ${response.data.stashes.length} stashes for account: ${username}`);
    return stashes;
  } catch (e: any) {
    logger.error(`Error while getting stashes from the GGG API: ${e.message}`);
    return [];
  }
};

const APIManager = {
  getCurrentCharacter: async () => {
    const characters = await getAllCharacters();
    const { activeProfile } = SettingsManager.settings;
    const currentCharacter = characters.find((character) =>
      activeProfile && activeProfile.charactername
        ? character.name === activeProfile.characterName
        : character.current
    );
    return currentCharacter;
  },
  getAllCharacters: async (): Promise<any[]> => {
    const characters = await getAllCharacters();
    return characters ?? [];
  },
  getDataForInventory: async (): Promise<Inventory> => {
    const inventory = await getDataForInventory();
    return inventory;
  },
  getSkillTree: async () => {
    const skillTree = await getSkillTree();
    return skillTree;
  },
  getAllStashTabs: async () => {
    const stashes = await getAllStashTabs();
    return stashes;
  },

  getStashTab: async (tabIndex) => {
    const stash = await getStashTab(tabIndex);
    return stash;
  },
};

export default APIManager;
