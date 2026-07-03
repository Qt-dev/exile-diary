const DBModule = require('../db/skilltree');
const GGGAPIModule = require('../GGGAPI');
const DB = DBModule.default ?? DBModule;
const API = GGGAPIModule.default ?? GGGAPIModule;
const logger = require('electron-log');
const EventEmitter = require('events');
const emitter = new EventEmitter();

const SkillTreeWatcher = {
  insertPassiveTree: DB.insertPassiveTree,
  getPreviousTree: DB.getPreviousTree,
  getSkillTree: API.getSkillTree,
  saveNewTree: async (timestamp) => {
    logger.info(`Checking for new skill tree at ${timestamp}`);
    const previousTree = await SkillTreeWatcher.getPreviousTree();
    const newTree = JSON.stringify(await SkillTreeWatcher.getSkillTree(timestamp).hashes);

    if (previousTree && newTree && newTree !== previousTree) {
      logger.info(`New skill tree found at ${timestamp}`);
      logger.info(`Previous Skill Tree: ${previousTree}`);
      logger.info(`New Skill Tree: ${newTree}`);
      await SkillTreeWatcher.insertPassiveTree(timestamp, newTree);
    }
  },
};

module.exports = SkillTreeWatcher;
module.exports.emitter = emitter;
