import DB from './index';
import Logger from 'electron-log';
const logger = Logger.scope('db/stashtabs');

const StashTabs = {
  insertStashData: async (
    timestamp: number | string,
    value: number,
    rawData,
    league: string
  ): Promise<boolean> => {
    logger.info('Inserting new stash data');
    const query = 'INSERT INTO stashes(timestamp, value, items) VALUES(?, ?, ?)';
    try {
      await DB.run(query, [timestamp, value, rawData], league);
      return true;
    } catch (err) {
      logger.error(`Error inserting new stash data: ${JSON.stringify(err)}`);
      return false;
    }
  },
  getStashData: async (timestamp: string, league: string): Promise<any> => {
    logger.info(`Getting stash data for ${league} at ${timestamp}`);
    const query =
      'SELECT items, value FROM stashes WHERE timestamp <= ? ORDER BY timestamp DESC LIMIT 1';
    try {
      const stash = await DB.get(query, [timestamp], league);
      return stash ?? [];
    } catch (err) {
      logger.error(`Error getting stash data: ${JSON.stringify(err)}`);
      return '{}';
    }
  },
  getPreviousStashValue: async (timestamp: number | string, league: string): Promise<number> => {
    logger.info(`Getting previous stash value for ${league} before ${timestamp}`);
    const query = 'SELECT value FROM stashes WHERE timestamp < ? ORDER BY timestamp DESC LIMIT 1';
    try {
      const { value } = (await DB.get(query, [timestamp], league)) as any;
      return value;
    } catch (err) {
      logger.error(`Error getting previous stash value: ${JSON.stringify(err)}`);
      return 0;
    }
  },
  getLatestStashAge: async (league: string): Promise<number> => {
    logger.info(`Getting latest stash age from DB`);
    const query =
      "SELECT IFNULL(MAX(timestamp), -1) AS timestamp FROM stashes WHERE items <> '{}' ";
    try {
      const { timestamp } = (await DB.get(query, [], league)) as any;
      return timestamp;
    } catch (err) {
      logger.error(`Error getting latest stash age: ${JSON.stringify(err)}`);
      return -1;
    }
  },
  getRunsSinceLastCheck: async (date: number): Promise<number> => {
    logger.info(`Getting maps since last check from DB`);
    const query =
      "SELECT count(1) as count FROM mapruns WHERE id > ? AND json_extract(runinfo, '$.ignored') IS NULL";
    try {
      const { count } = (await DB.get(query, [date])) as any;
      return count;
    } catch (err) {
      logger.error(`Error getting maps since last check: ${JSON.stringify(err)}`);
      return 0;
    }
  },
  getLatestStashValue: async (
    league: string
  ): Promise<{ timestamp: number; value: number; len: number }> => {
    logger.info(`Getting latest stash value from DB`);
    const query =
      'SELECT timestamp, value, length(items) as len FROM stashes ORDER BY timestamp DESC LIMIT 1';
    try {
      const [{ timestamp, value, len }] = (await DB.all(query, [], league)) as any[];
      return { timestamp, value, len };
    } catch (err) {
      logger.error(`Error getting latest stash value: ${JSON.stringify(err)}`);
      return { timestamp: 0, value: 0, len: 0 };
    }
  },
};

export default StashTabs;
