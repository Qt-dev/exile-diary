import logger from 'electron-log';
import DB from './db/stats';

class SearchManager {
  sendMessage: Function = () => {};
  constructor() {}

  registerMessageHandler(handler: Function) {
    this.sendMessage = handler;
  }

  async search(params) {
    const { from, to, minLootValue } = params;
    const items = await DB.getAllItemsForDates(from, to, minLootValue);
    const runs = await DB.getAllRunsForDates(from, to);
    logger.info(`Found ${items.length} items and ${runs.length} runs.`);
    this.sendMessage("search:register-results", { items, runs });
  }
}

const searchManager = new SearchManager();

export default searchManager;