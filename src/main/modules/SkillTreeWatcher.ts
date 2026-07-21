import logger from 'electron-log';
import EventEmitter from 'events';
import DB from '../db/skilltree';
import API from '../GGGAPI';

const emitter = new EventEmitter();

const SkillTreeWatcher = {
  insertPassivetree: DB.insertPassivetree,
  getPreviousTree: DB.getPreviousTree,
  getSkillTree: API.getSkillTree,
  saveNewTree: async (timestamp: string) => {
    logger.info(`Checking for new skill tree at ${timestamp}`);
    const previousTree = await SkillTreeWatcher.getPreviousTree();
    const previousTreeData = previousTree?.data ?? null;
    const newTree = JSON.stringify((await SkillTreeWatcher.getSkillTree()).hashes);

    if (previousTreeData && newTree && newTree !== previousTreeData) {
      logger.info(`New skill tree found at ${timestamp}`);
      logger.info(`Previous Skill Tree: ${previousTreeData}`);
      logger.info(`New Skill Tree: ${newTree}`);
      await SkillTreeWatcher.insertPassivetree(Number(timestamp), newTree);
    }
  },
};

export { emitter };
export default {
  ...SkillTreeWatcher,
  emitter,
};
