import DB from './db/stashtabs';
import SettingsManager from './SettingsManager';
import StashGetter from './modules/StashGetter';
import zlib from 'zlib';
import dayjs from 'dayjs';
import logger from 'electron-log';

class StashTabsManager {
  constructor() {}

  async hasReachedMapLimit(limit: number, date: number): Promise<boolean> {
    const maps = await DB.getRunsSinceLastCheck(date);
    return maps >= limit;
  }

  async getStashData(date: number = Number(dayjs().format('YYYYMMDDHHmmss'))): Promise<any> {
    const league = SettingsManager.get('activeProfile').league;
    const data = await DB.getStashData(date, league);
    const items = data
      ? await new Promise((resolve) => {
          zlib.inflate(data.items, (err, buffer) => {
            if (err) {
              logger.error('Error inflating stash data', err);
              // Data is not compressed
              resolve(JSON.parse(data.items));
            } else {
              resolve(JSON.parse(buffer.toString()));
            }
          });
        })
      : [];
    return { ...data, items };
  }

  async refresh(): Promise<void> {
    await StashGetter.get();
  }
}

const stashTabsManager = new StashTabsManager();

export default stashTabsManager;
