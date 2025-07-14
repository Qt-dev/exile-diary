import DB from './index';
import Logger from 'electron-log';
const logger = Logger.scope('db/items');

const Items = {
  insertItems: (items: any[]) => {
    logger.debug(`Inserting ${items.length} items`);
    const query = `
      INSERT INTO item
      (item_id, event_id, icon, name, rarity, category, identified, typeline, sockets, stack_size, raw_data, value, original_value)
      values(?, (SELECT id FROM event WHERE event.timestamp = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
    return DB.transaction(query, items);
  },
  getMatchingItemsCount: async (itemIds: string[]): Promise<number> => {
    const itemQueries: string[] = itemIds.map((id) => `(id = '${id}')`);

    const query = `SELECT COUNT(1) AS count FROM item WHERE (${itemQueries.join(' OR ')})`;

    return DB.get(query);
  },

  updateIgnoredItems: async (items: { id: string; status: boolean }[]) => {
    logger.debug(`Updating ${items.length} items ignore status`);
    const query = `
      UPDATE item
        SET ignored = ?
        WHERE id = ?
    `;
    return DB.transaction(
      query,
      items.map(({ id, status }) => [status ? 1 : 0, id])
    );
  },

  getAllItemsValues: async () => {
    logger.debug(`Getting all items values`);
    const query = `
      SELECT id, value
      FROM item
    `;
    return DB.all(query);
  },
};

export default Items;
