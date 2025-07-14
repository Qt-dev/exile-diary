import DB from './index';
import Logger from 'electron-log';
const logger = Logger.scope('db/skilltree');

const SkillTree = {
  getPreviousTree: async () => {
    logger.info('Getting previous skill tree');
    const query = 'SELECT timestamp, data FROM passives ORDER BY timestamp DESC LIMIT 1';

    try {
      const row = await DB.get(query);
      return row;
    } catch (err) {
      logger.error(`Error getting previous skill tree: ${JSON.stringify(err)}`);
      return null;
    }
  },

  insertPassivetree: async (timestamp: number, data: string) => {
    logger.info('Inserting new skill tree');
    const query = 'INSERT INTO passives(timestamp, data) values(?, ?)';

    try {
      await DB.run(query, [timestamp, data]);
      return true;
    } catch (err) {
      logger.error(`Error inserting new skill tree: ${JSON.stringify(err)}`);
      return false;
    }
  },
};

export default SkillTree;
