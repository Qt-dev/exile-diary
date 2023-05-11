import DB from './index';
import logger from 'electron-log';

const SkillTree = {
  getPreviousTree: async () => {
    logger.info('Getting previous skill tree');
    const query = 'select timestamp, data from passives order by timestamp desc limit 1';

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
    const query = 'insert into passives(timestamp, data) values(?, ?)';

    try {
      await DB.run(query, [timestamp, data]);
      return true;
    } catch (err) {
      logger.error(`Error inserting new skill tree: ${JSON.stringify(err)}`);
      return false;
    }
  }
  
}

export default SkillTree;