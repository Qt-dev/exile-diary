import logger from 'electron-log';
import DB from './db/stats';

class SearchManager {
  sendMessage: Function = () => {};
  constructor() {}

  registerMessageHandler(handler: Function) {
    this.sendMessage = handler;
  }

  async search(params) {
    const { from, to } = params;
    const items = await DB.getAllItemsForDates(from, to);
    this.sendMessage("search:register-results", { items });
  }
}

const searchManager = new SearchManager();

export default searchManager;