import logger from 'electron-log';
import { app } from 'electron';
import Axios from 'axios';
import { setupCache } from 'axios-cache-interceptor';
import SettingsManager from './SettingsManager';
import AuthManager from './AuthManager';
import Bottleneck from 'bottleneck';
const axios = setupCache(Axios);

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 333,
});

limiter.on('failed', async (error, jobInfo) => {
  const { retryCount } = jobInfo;
  logger.error(
    `Request ${jobInfo.options.id} failed with ${error.message}. Retried ${retryCount} times.`
  );
  if(error.stats === 429) {
    logger.error('Too many requests. Waiting 10 seconds before retrying...');
    logger.error(`Retry-After Header: ${error.getResponseHeader("Retry-After")}`);
    return ((error.getResponseHeader("Retry-After") || 1) * 1000) + 1000
  }

  if (retryCount > 2) {
    logger.error(`Request ${jobInfo.options.id} failed ${retryCount} times. No more retries.`);
  } else {
    logger.error(`Request ${jobInfo.options.id} failed. Retrying... in 5 second.`);
    return 5000;
  }
});

// const Endpoints = {
//   // character: ({ username }) =>
//   //   `https://www.pathofexile.com/character-window/get-characters?username=${encodeURIComponent(
//   //     username
//   //   )}`,
//   skillTree: ({ username, league, characterName }) =>
//     `https://www.pathofexile.com/character-window/get-passive-skills?league=${league}&username=${encodeURIComponent(
//       username
//     )}&character=${encodeURIComponent(characterName)}`,
//   inventory: ({ username, league, characterName }) =>
//     `https://www.pathofexile.com/character-window/get-items?league=${league}&username=${encodeURIComponent(
//       username
//     )}&character=${encodeURIComponent(characterName)}`,
//   stash: ({ username, league, tabIndex }) =>
//     `https://www.pathofexile.com/character-window/get-stash-items?league=${league}&username=${encodeURIComponent(
//       username
//     )}&tabs=0&tabIndex=${tabIndex}&username=${encodeURIComponent(username)}`,
//   stashes: ({ username, league }) =>
//     `https://www.pathofexile.com/character-window/get-stash-items?league=${league}&username=${encodeURIComponent(
//       username
//     )}&tabs=1&tabIndex=0&username=${encodeURIComponent(username)}`,
// };

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

const request = (params, priority = 5) => {
  return limiter.schedule({ priority }, () => {
    logger.info('Running request');
    if(!params.cache) {
      params.cache = {
        ttl: 1000 * 15 // 15 seconds
      };
    }
    return axios(params).then((response) => {
      if(response.cached) logger.info(`Response from cache for ${params.url}`);
      return response;
    });
  });
};

const getSettings = async (needProfile = true) => {
  const { settings } = SettingsManager;
  const { username, activeProfile } = settings;
  if (!username) throw new Error('Missing username');
  if ((!activeProfile || !activeProfile.characterName) && needProfile) throw new Error('Missing Active Profile');
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
    const response: any = await request(getRequestParams(Endpoints.characters(), token));
    const characters = await response.data.characters;
    logger.info(
      `Found ${characters.length} characters from the GGG API for account: ${username}`
    );
    return characters;
  } catch (e: any) {
    logger.error(`Error while getting characters from the GGG API: ${e.message}`);
    return [];
  }
};

const getDataForInventory = async () => {
  logger.info('Getting inventory and XP data from the GGG API');
  try {
    const { characterName, token } = await getSettings();
    const response: any = await request(
      getRequestParams(Endpoints.character({ characterName }), token),
      4
    );
    const character = await response.data.character;
    const { inventory, equipment, experience } = character;
    logger.info(`Found inventory for character: ${characterName}`);
    return {
      inventory,
      equipment,
      experience,
    };
  } catch (e: any) {
    logger.error(`Error while getting inventory from the GGG API: ${e.message}`);
    return [];
  }
};

const getSkillTree = async () => {
  logger.info('Getting skill tree from the GGG API');
  try {
    const { characterName, token } = await getSettings();
    const response: any = await request(
      getRequestParams(Endpoints.character({ characterName }), token)
    );
    const skillTree = await response.data.character.passives;
    logger.info(`Found skill tree for character: ${characterName}`);
    return skillTree;
  } catch (e: any) {
    logger.error(`Error while getting skill tree from the GGG API: ${e.message}`);
    return { hashes: [], jewel_data: {} };
  }
};

const getStash = async (stashId) => {
  logger.info('Getting stash from the GGG API');
  try {
    const { username, league, token } = await getSettings();
    const response: any = await request(
      getRequestParams(Endpoints.stash({ league, stashId }), token)
    );
    const stash = await response.data.stash;
    logger.info(`Found stash ${stashId} for account: ${username}`);
    return stash;
  } catch (e: any) {
    logger.error(`Error while getting stash from the GGG API: ${e.message}`);
    return { items: [] };
  }
};

const getStashes = async () => {
  logger.info('Getting stashes from the GGG API');
  try {
    const { username, league, token } = await getSettings();
    const response: any = await request(getRequestParams(Endpoints.stashes(league), token));
    const stashes = await response.data.stashes;
    logger.info(`Found stashes for account: ${username}`);
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
  getAllCharacters: async () => {
    const characters = await getAllCharacters();
    return characters;
  },
  getDataForInventory: async () => {
    const inventory = await getDataForInventory();
    return inventory;
  },
  getSkillTree: async () => {
    const skillTree = await getSkillTree();
    return skillTree;
  },
  getStashes: async () => {
    const stashes = await getStashes();
    return stashes;
  },

  getStash: async (tabIndex) => {
    const stash = await getStash(tabIndex);
    return stash;
  },
};

export default APIManager;
