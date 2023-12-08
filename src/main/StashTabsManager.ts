import DB from './db/stashtabs';
import SettingsManager from './SettingsManager';
import StashGetter from './modules/StashGetter';
import RendererLogger from './RendererLogger';
import zlib from 'zlib';
import dayjs from 'dayjs';
import logger from 'electron-log';

class StashTabsManager {

  async hasReachedMapLimit(limit: number, date: number): Promise<boolean> {
    const maps = await DB.getRunsSinceLastCheck(date);
    return maps >= limit;
  }

  async getStashData(date: number = Number(dayjs().format('YYYYMMDDHHmmss'))): Promise<any> {
    const league = SettingsManager.get('activeProfile').league;
    const data = await DB.getStashData(date, league);
    const items = data && data.items 
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
    const stashTabNumbers =
      SettingsManager.get('trackedStashTabs')?.[SettingsManager.get('activeProfile').league]
        ?.length ?? 0;
    const startTime = dayjs();
    RendererLogger.log({
      messages: [
        { text: 'Refreshing stash data for ' },
        { text: stashTabNumbers, type: 'important' },
        { text: ' stash tabs' },
      ],
    });
    await StashGetter.get();
    RendererLogger.log({
      messages: [
        { text: 'Stash data refreshed for ' },
        { text: stashTabNumbers, type: 'important' },
        { text: ' stash tabs in ' },
        { text: dayjs().diff(startTime, 'millisecond'), type: 'important' },
        { text: ' milliseconds' },
      ],
    });
  }
}

const stashTabsManager = new StashTabsManager();

export default stashTabsManager;
