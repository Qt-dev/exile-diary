import DB from './index';
import dayjs from 'dayjs';
import Logger from 'electron-log';
const logger = Logger.scope('db/league');

const League = {
  addLeague: async (league: string) => {
    logger.info(`Adding new league to DB if it does not exist. League: ${league}`);
    const query = 'insert or ignore into leagues(timestamp, league) values(?, ?)';

    try {
      await DB.run(query, [dayjs().format('YYYYMMDDHHmmss'), league]);
    } catch (err) {
      logger.error(`Error inserting new league: ${JSON.stringify(err)}`);
    }
  },
};

export default League;
