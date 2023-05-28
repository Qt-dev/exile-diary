import DB from './index';
import logger from 'electron-log';
import zlib from 'zlib';

export default {
  getFullRates: async (league: string, date: string): Promise<any> => {
    logger.info(`Getting rates for ${date} (league: ${league}) from DB`);
    const query =
      'SELECT date, data FROM fullrates WHERE date <= ? OR date = (SELECT min(date) FROM fullrates) ORDER BY date DESC';

    try {
      const [{ data }] = (await DB.all(query, [date], league)) as any[];
      return await new Promise((resolve, reject) => {
        zlib.inflate(data, (err, buffer) => {
          if (err) {
            // old data - compression not implemented yet, just parse directly
            resolve(JSON.parse(data));
          } else {
            resolve(JSON.parse(buffer.toString()));
          }
        });
      });
    } catch (err) {
      logger.error(`Error getting rates for ${date} (league: ${league}): ${JSON.stringify(err)}`);
      return {};
    }
  },
};
