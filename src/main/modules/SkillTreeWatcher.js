import DB from '../db/skilltree';
import API from '../GGGAPI';
import logger from 'electron-log';
import EventEmitter from 'events';
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
export default SkillTreeWatcher;
