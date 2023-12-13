import DB from './index';
import Logger from 'electron-log';
import zlib from 'zlib';
const logger = Logger.scope('db/rates');

const rates = {
  getFullRates: async (league: string, date: string): Promise<any> => {
    logger.info(`Getting rates for ${date} (league: ${league}) from DB`);
    const query =
      'SELECT date, data FROM fullrates WHERE date <= ? OR date = (SELECT min(date) FROM fullrates) ORDER BY date DESC';

    try {
      const [{ data }] = DB.all(query, [date], league) as any[];
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
  cleanRates: async (league: string, date: string): Promise<void> => {
    logger.info(`Cleaning rates for ${date} (league: ${league}) from DB`);
    const query = 'DELETE FROM fullrates WHERE date < ?';
    try {
      DB.run(query, [date], league);
    } catch (err) {
      logger.error(`Error cleaning rates for ${date} (league: ${league}): ${JSON.stringify(err)}`);
    }
  },
  insertRates: async (league: string, date: string, rates: any): Promise<boolean> => {
    logger.info(`Inserting rates for ${date} (league: ${league}) into DB`);
    const query = 'INSERT OR IGNORE INTO fullrates (date, data) VALUES (?, ?)';
    const data = JSON.stringify(rates);
    const buffer = await new Promise((resolve, reject) => {
      zlib.deflate(data, (err, buffer) => {
        if (err) {
          reject(err);
        } else {
          resolve(buffer);
        }
      });
    });
    try {
      DB.run(query, [date, buffer], league);
      return true;
    } catch (err) {
      logger.error(`Error inserting rates for ${date} (league: ${league}): ${JSON.stringify(err)}`);
      return false;
    }
  },
  hasExistingRates: async (league: string, date: string): Promise<boolean> => {
    logger.info(`Checking if rates for ${date} (league: ${league}) exist in DB`);
    const query = 'SELECT COUNT(*) as count FROM fullrates WHERE date = ?';
    try {
      const [{ count }] = DB.all(query, [date], league) as any[];
      return count > 0;
    } catch (err) {
      logger.error(
        `Error checking if rates for ${date} (league: ${league}) exist in DB: ${JSON.stringify(
          err
        )}`
      );
      return false;
    }
  },
};

export default rates;
