import logger from 'electron-log';
import { app } from 'electron';
import axios, { AxiosResponse } from 'axios';
import SettingsManager from './SettingsManager';
import AuthManager from './AuthManager';

const Endpoints = {
  character: ({ accountName }) =>
    `https://www.pathofexile.com/character-window/get-characters?accountName=${encodeURIComponent(
      accountName
    )}`,
  skillTree: ({ accountName, league, characterName }) =>
    `https://www.pathofexile.com/character-window/get-passive-skills?league=${league}&accountName=${encodeURIComponent(
      accountName
    )}&character=${encodeURIComponent(characterName)}`,
  inventory: ({ accountName, league, characterName }) =>
    `https://www.pathofexile.com/character-window/get-items?league=${league}&accountName=${encodeURIComponent(
      accountName
    )}&character=${encodeURIComponent(characterName)}`,
  stash: ({ accountName, league, tabIndex }) =>
    `https://www.pathofexile.com/character-window/get-stash-items?league=${league}&accountName=${encodeURIComponent(
      accountName
    )}&tabs=0&tabIndex=${tabIndex}&accountName=${encodeURIComponent(accountName)}`,
  stashes: ({ accountName, league }) =>
    `https://www.pathofexile.com/character-window/get-stash-items?league=${league}&accountName=${encodeURIComponent(
      accountName
    )}&tabs=1&tabIndex=0&accountName=${encodeURIComponent(accountName)}`,
};

const newEndPoints = {
  character: () =>
    '/character',
}

const adminEmail = 'quentin@devauchelle.com';

const getRequestParams = (path, poesessid) => {
  return {
    hostname: 'www.pathofexile.com',
    path: path,
    method: 'GET',
    headers: {
      'User-Agent': `exile-diary-reborn/${app.getVersion()}`,
      Referer: 'http://www.pathofexile.com/',
      Cookie: `POESESSID=${poesessid}`,
    },
  };
};

const getNewRequestParams = (url, token) => {
  return {
    baseURL: 'https://api.pathofexile.com',
    url,
    method: 'GET',
    headers: {
      'User-Agent': `OAuth exile-diary-reborn/${app.getVersion()} (contact: ${adminEmail})`,
      Authorization: `Bearer ${token}`,
    }
  }
};


const getSettings = () => {
  const { settings } = SettingsManager;
  const { poesessid, accountName, activeProfile } = settings;
  if (!poesessid || !accountName) throw new Error('Missing poesessid or accountName');
  if (!activeProfile || !activeProfile.characterName) throw new Error('Missing Active Profile');
  return settings;
};

const getAllCharacters = async () => {
  logger.info('Getting characters from the GGG API');
  const { accountName } = getSettings();
  const token = await AuthManager.getToken();
  const response: AxiosResponse = await axios(getNewRequestParams(newEndPoints.character(), token));
  const characters = await response.data.characters;
  logger.info(`Found ${characters.length} characters from the GGG API for account: ${accountName}`);
  return characters;
};

const getInventory = async () => {
  logger.info('Getting inventory from the GGG API');
  const { poesessid, accountName, activeProfile } = getSettings();
  const { characterName, league } = activeProfile;
  const url = Endpoints.inventory({ accountName, league, characterName });
  const response: AxiosResponse = await axios.get(url, getRequestParams(url, poesessid));
  const inventory = await response.data;
  logger.info(`Found inventory for character: ${characterName}`);
  return inventory;
};

const getSkillTree = async () => {
  logger.info('Getting skill tree from the GGG API');
  const { poesessid, accountName, activeProfile } = getSettings();
  const { characterName, league } = activeProfile;
  const url = Endpoints.skillTree({ accountName, league, characterName });
  const response: AxiosResponse = await axios.get(url, getRequestParams(url, poesessid));
  const skillTree = await response.data;
  logger.info(`Found skill tree for character: ${characterName}`);
  return skillTree;
};

const getStash = async (tabIndex) => {
  logger.info('Getting stash from the GGG API');
  const { poesessid, accountName, activeProfile } = getSettings();
  const { league } = activeProfile;
  const url = Endpoints.stash({ accountName, league, tabIndex });
  const response: AxiosResponse = await axios.get(url, getRequestParams(url, poesessid));
  const stash = await response.data;
  logger.info(`Found stash for account: ${accountName}`);
  return stash;
};

const getStashes = async () => {
  logger.info('Getting stashes from the GGG API');
  const { poesessid, accountName, activeProfile } = getSettings();
  const { league } = activeProfile;
  const url = Endpoints.stashes({ accountName, league });
  const response: AxiosResponse = await axios.get(url, getRequestParams(url, poesessid));
  const stashes = await response.data;
  logger.info(`Found stashes for account: ${accountName}`);
  return stashes;
};

const APIManager = {
  getCurrentCharacter: async () => {
    const characters = await getAllCharacters();
    const { activeProfile } = SettingsManager.settings;
    const currentCharacter = characters.find(
      (character) => (activeProfile && activeProfile.charactername) ? character.name === activeProfile.characterName : character.current
    );
    return currentCharacter;
  },
  getAllCharacters: async () => {
    const characters = await getAllCharacters();
    return characters;
  },
  getInventory: async () => {
    const inventory = await getInventory();
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
