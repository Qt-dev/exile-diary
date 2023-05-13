import logger from 'electron-log';
import { app } from 'electron';
import axios, { AxiosResponse } from 'axios';
import SettingsManager from './SettingsManager';
import AuthManager from './AuthManager';
import Bottleneck from 'bottleneck';

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 333,
});

limiter.on('failed', async (error, jobInfo) => {
  const { retryCount } = jobInfo;
  logger.error(
    `Request ${jobInfo.options.id} failed with ${error.message}. Retrying ${retryCount} times.`
  );
  logger.error(error, jobInfo);
  if (retryCount === 0) {
    logger.error(`Request ${jobInfo.options.id} failed. Retrying...`);
  } else {
    logger.error(`Request ${jobInfo.options.id} failed ${retryCount} times. No more retries.`);
  }
});

// const Endpoints = {
//   // character: ({ accountName }) =>
//   //   `https://www.pathofexile.com/character-window/get-characters?accountName=${encodeURIComponent(
//   //     accountName
//   //   )}`,
//   skillTree: ({ accountName, league, characterName }) =>
//     `https://www.pathofexile.com/character-window/get-passive-skills?league=${league}&accountName=${encodeURIComponent(
//       accountName
//     )}&character=${encodeURIComponent(characterName)}`,
//   inventory: ({ accountName, league, characterName }) =>
//     `https://www.pathofexile.com/character-window/get-items?league=${league}&accountName=${encodeURIComponent(
//       accountName
//     )}&character=${encodeURIComponent(characterName)}`,
//   stash: ({ accountName, league, tabIndex }) =>
//     `https://www.pathofexile.com/character-window/get-stash-items?league=${league}&accountName=${encodeURIComponent(
//       accountName
//     )}&tabs=0&tabIndex=${tabIndex}&accountName=${encodeURIComponent(accountName)}`,
//   stashes: ({ accountName, league }) =>
//     `https://www.pathofexile.com/character-window/get-stash-items?league=${league}&accountName=${encodeURIComponent(
//       accountName
//     )}&tabs=1&tabIndex=0&accountName=${encodeURIComponent(accountName)}`,
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
    return axios(params);
  });
};

const getSettings = async () => {
  const { settings } = SettingsManager;
  const { accountName, activeProfile } = settings;
  if (!accountName) throw new Error('Missing accountName');
  if (!activeProfile || !activeProfile.characterName) throw new Error('Missing Active Profile');
  const token = await AuthManager.getToken();
  return {
    accountName,
    characterName: activeProfile.characterName,
    league: activeProfile.league,
    token,
  };
};

const getAllCharacters = async () => {
  logger.info('Getting characters from the GGG API');
  try {
    const { accountName, token } = await getSettings();
    const response: any = await request(getRequestParams(Endpoints.characters(), token));
    const characters = await response.data.characters;
    logger.info(
      `Found ${characters.length} characters from the GGG API for account: ${accountName}`
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
    const { accountName, league, token } = await getSettings();
    const response: any = await request(
      getRequestParams(Endpoints.stash({ league, stashId }), token)
    );
    const stash = await response.data.stash;
    logger.info(`Found stash ${stashId} for account: ${accountName}`);
    return stash;
  } catch (e: any) {
    logger.error(`Error while getting stash from the GGG API: ${e.message}`);
    return { items: [] };
  }
};

const getStashes = async () => {
  logger.info('Getting stashes from the GGG API');
  try {
    const { accountName, league, token } = await getSettings();
    const response: any = await request(getRequestParams(Endpoints.stashes(league), token));
    const stashes = await response.data.stashes;
    logger.info(`Found stashes for account: ${accountName}`);
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
