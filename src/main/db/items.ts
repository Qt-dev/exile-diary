import DB from './index';
import Logger from 'electron-log';
const logger = Logger.scope('db/items');

const Items = {
  insertItems: (items: any[]) => {
    logger.debug(`Inserting ${items.length} items`);
    const query = `
      INSERT INTO items
      (id, event_id, icon, name, rarity, category, identified, typeline, sockets, stacksize, rawdata, value, original_value)
      values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? ,?)
      `;
    return DB.transaction(query, items);
  },
};

export default Items;
