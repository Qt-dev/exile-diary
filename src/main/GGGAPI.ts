import logger from 'electron-log';
import { app } from 'electron';
import Axios from 'axios';
import { setupCache } from 'axios-cache-interceptor';
import SettingsManager from './SettingsManager';
import AuthManager from './AuthManager';
import Bottleneck from 'bottleneck';
import RendererLogger from './RendererLogger';
const axios = setupCache(Axios);
const CACHE_TIME_IN_SECONDS = 5;

type Inventory = {
  inventory: any[];
  equipment: any[];
  experience: number;
};

const limiters = new Bottleneck.Group({
  maxConcurrent: 1,
  minTime: 333,
});

const handleFailure = (type: string) => async (error, jobInfo) => {
  const { retryCount } = jobInfo;
  logger.error(
    `Request ${jobInfo.options.id} failed (type: ${type}) with ${error.message}. Retried ${retryCount} times.`
  );
  if (error.status === 429) {
    logger.error(
      `Too many requests. Waiting ${error.getResponseHeader(
        'Retry-After'
      )} seconds before retrying...`
    );
    logger.error(`Retry-After Header: ${error.getResponseHeader('Retry-After')}`);
    return (error.getResponseHeader('Retry-After') || 1) * 1000 + 1000;
  }

  logger.error(error.response);
  if (retryCount > 1) {
    logger.error(`Request ${jobInfo.options.id} failed ${retryCount} times. No more retries.`);
  } else {
    logger.error(`Request ${jobInfo.options.id} failed. Retrying... in 10 second.`);
    return 10000;
  }
};

limiters.on('failed', handleFailure('failed'));
limiters.on('error', handleFailure('error'));

limiters.on('done', (jobInfo) => {
  // globalLimiter.once('running', () => {
  logger.info(jobInfo);
  // })
});

limiters.on('executing', async (jobInfo) => {
  logger.info(`========Request ${jobInfo.options.id} started.`);
  logger.info(jobInfo);
  logger.info(`========Request ${jobInfo.options.id} execution callback finished.`);
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
      'User-Agent': `OAuth exile-diary-reborn/${app.getVersion()} (contact: ${adminEmail})`,
      Authorization: `Bearer ${token}`,
    },
  };
};

const request = ({ params, group, cacheTime = CACHE_TIME_IN_SECONDS }) => {
  const limiter = limiters.key(group);
  return limiter.schedule({}, () => {
    if (!params.cache) {
      params.cache = {
        ttl: 1000 * cacheTime,
      };
    }
    return axios(params).then(async (response) => {
      if (response.cached) {
        logger.info(`Response from cache for ${params.url}`);
      } else {
        let periods: any = [];
        const rateLimitRules = response.headers['x-rate-limit-account']
          .split(',')
          .map((encodedRules) => {
            const [maxHits, period] = encodedRules.split(':');
            periods.push(period);
            return {
              maxHits,
              period,
            };
          });

        const status = response.headers['x-rate-limit-account-state']
          .split(',')
          .map((encodedStatus) => {
            const [hits, period] = encodedStatus.split(':');
            return {
              hits,
              period,
            };
          });

        await Promise.all(
          periods.map(async (period) => {
            const max = rateLimitRules.find((rule) => rule.period === period).maxHits;
            const hits = status.find((rule) => rule.period === period).hits;
            const remaining = max - hits;
            if (remaining < 1) {
              logger.info(
                `Hit GGG Rate Limit on ${group} request: ${remaining} hits remaining for period ${period}. Waiting for ${period} seconds for next request.`
              );
              RendererLogger.log({
                messages: [
                  {
                    text: `Hit GGG Rate Limit on ${group} request: Waiting for `,
                  },
                  {
                    text: `${period} seconds`,
                    type: 'important',
                  },
                  {
                    text: ' before the next request.',
                  },
                ],
              });
              await new Promise(() =>
                setTimeout(() => {
                  logger.info(`We are good to go for ${group} on period ${period}!`);
                }, period * 1000)
              );
            }
          })
        );
      }
      return response;
    });
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
      group: '/character',
      // cacheTime: 60 * 5,
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
      group: '/character',
    });
    const character = await response.data.character;
    const { inventory: mainInventory, equipment, experience } = character;
    const rucksack = character.rucksack ?? [];
    const inventory = [...mainInventory, ...rucksack];
    logger.info(`Found inventory for character: ${characterName}`);
    // logger.debug(`Inventory: ${JSON.stringify(inventory)}`);
    // logger.debug(`Equipment: ${JSON.stringify(equipment)}`);
    // logger.debug(`Experience: ${experience}`);
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
      group: '/character',
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
      group: '/stash',
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
      group: '/stash',
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
