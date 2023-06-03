import DB from './db/stashtabs';

class StashTabsManager {
  constructor() {}

  async hasReachedMapLimit(limit: number, date: number): Promise<boolean> {
    const maps = await DB.getRunsSinceLastCheck(date);
    return maps >= limit;
  }
}

const stashTabsManager = new StashTabsManager();

export default stashTabsManager;
