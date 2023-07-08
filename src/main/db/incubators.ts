import DB from './index';
import Logger from 'electron-log';
const logger = Logger.scope('db/incubators');

const incubators = {
  getPreviousIncubators: async () => {
    logger.info('Getting previous incubators');
    const query = 'select timestamp, data from incubators order by timestamp desc limit 1';

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
    const query = 'insert into incubators(timestamp, data) values(?, ?)';

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
