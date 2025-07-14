import DB from './index';
import Logger from 'electron-log';
const logger = Logger.scope('db/incubators');

const incubators = {
  getPreviousIncubators: async () => {
    logger.info('Getting previous incubators');
    const query = 'SELECT timestamp, data FROM incubator ORDER BY timestamp DESC LIMIT 1';

    try {
      const row = await DB.get(query);
      return row;
    } catch (err) {
      logger.error(`Error getting previous incubators: ${JSON.stringify(err)}`);
      return null;
    }
  },

  insertNewIncubators: async (timestamp: number, data: string) => {
    logger.info('Inserting new incubators');
    const query = 'INSERT INTO incubator(timestamp, data) values(?, ?)';

    try {
      await DB.run(query, [timestamp, data]);
      return true;
    } catch (err) {
      logger.error(`Error inserting new incubators: ${JSON.stringify(err)}`);
      return false;
    }
  },
};

export default incubators;
