import DB from './index';
import logger from 'electron-log';

const StashTabs = {
  insertStashData: async (timestamp: number, rawData, value: number, league: string) : Promise<boolean> => {
    logger.info('Inserting new stash data');
    const query = 'insert into stashes(timestamp, items, value) values(?, ?, ?)';
    try {
      await DB.run(query, [timestamp, rawData, value], league);
      return true;
    } catch (err) {
      logger.error(`Error inserting new stash data: ${JSON.stringify(err)}`);
      return false;
    }
  },
  getPreviousStashValue: async (timestamp: number, league: string): Promise<number> => {
    logger.info(`Getting previous stash value for ${league}`);
    const query = 'select value from stashes where timestamp < ? order by timestamp desc limit 1';
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
    const query = "select ifnull(max(timestamp), -1) as timestamp from stashes where items <> '{}' "
    try {
      const { timestamp } = (await DB.get(query), league) as any;
      return timestamp; 
    } catch(err) {
      logger.error(`Error getting latest stash age: ${JSON.stringify(err)}`);
      return -1;
    }
  },
  getRunsSinceLastCheck: async (date: number): Promise<number> => {
    logger.info(`Getting maps since last check from DB`);
    const query = "select count(1) as count from mapruns where id > ? and json_extract(runinfo, '$.ignored') is null";
    try {
      const { count } = (await DB.get(query, [date])) as any;
      return count; 
    }
    catch(err) {
      logger.error(`Error getting maps since last check: ${JSON.stringify(err)}`);
      return 0;
    }
  },
  getLatestStashValue: async (): Promise<any> => {
    logger.info(`Getting latest stash value from DB`);
    const query = 'select value, length(items) as len from stashes order by timestamp desc limit 1';
    try {
      const [{ value, len }] = (await DB.all(query)) as any[];
      return { value, len };
    } catch(err) {
      logger.error(`Error getting latest stash value: ${JSON.stringify(err)}`);
      return {};
    }
  },
};

export default StashTabs;
