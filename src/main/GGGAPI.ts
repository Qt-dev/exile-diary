import logger from 'electron-log';
import { app } from 'electron';
import axios, { AxiosResponse } from 'axios';
import SettingsManager from './SettingsManager';

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
};

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

const getSettings = () => {
  const { settings } = SettingsManager;
  const { poesessid, accountName, activeProfile } = settings;
  if (!poesessid || !accountName) throw new Error('Missing poesessid or accountName');
  if (!activeProfile || !activeProfile.characterName) throw new Error('Missing Active Profile');
  return settings;
};

const getAllCharacters = async () => {
  logger.info('Getting characters from the GGG API');
  const { poesessid, accountName } = getSettings();
  const url = Endpoints.character({ accountName });
  const response: AxiosResponse = await axios.get(url, getRequestParams(url, poesessid));
  const characters = await response.data;
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

const APIManager = {
  getCurrentCharacter: async () => {
    const characters = await getAllCharacters();
    const { activeProfile } = SettingsManager.settings;
    const currentCharacter = characters.find(
      (character) => character.name === activeProfile.characterName
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
};

export default APIManager;
