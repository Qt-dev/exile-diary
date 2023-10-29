import logger from 'electron-log';
import DB from './db/stats';

class SearchManager {
  sendMessage: Function = () => {};
  constructor() {}

  registerMessageHandler(handler: Function) {
    this.sendMessage = handler;
  }

  async search(params) {
    const { from, to, minLootValue, neededItemName, selectedMaps, minMapValue } = params;
    const runs = await DB.getAllRunsForDates(params);
    const items = await DB.getAllItemsForRuns({ runs, minLootValue });

    logger.info(`Found ${items.length} items and ${runs.length} runs.`);
    this.sendMessage('search:register-results', { items, runs });
  }
}

const searchManager = new SearchManager();

export default searchManager;
