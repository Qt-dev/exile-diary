import DB from '../index';
import Logger from 'electron-log';

const logger = Logger.scope('db/items');

const directEventItemInsertQuery = `
      INSERT INTO item
      (item_id, event_id, icon, name, rarity, category, identified, typeline, sockets, stack_size, raw_data, value, original_value, valuation, ignored)
      values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

const Items = {
  insertItems: (items: any[], eventId?: number) => {
    logger.debug(`Inserting ${items.length} items`);
    logger.debug(items);
    const params =
      eventId === undefined
        ? items
        : items.map(([itemId, _eventTimestamp, ...rest]) => [itemId, eventId, ...rest]);
    const query = `
      INSERT INTO item
      (item_id, event_id, icon, name, rarity, category, identified, typeline, sockets, stack_size, raw_data, value, original_value, valuation)
      values(?, ${eventId === undefined ? '(SELECT id FROM event WHERE event.timestamp = ?)' : '?'}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
    return DB.transaction(query, params);
  },

  insertItemsAndInventory: (
    items: any[],
    eventId: number,
    inventoryTimestamp: string,
    inventory: Record<string, any>,
    ignoredItems: { id: string; status: boolean }[]
  ) => {
    const ignoredByItemId = new Map(ignoredItems.map(({ id, status }) => [id, status]));
    const itemSteps = items.map(([itemId, _eventTimestamp, ...rest]) => ({
      query: directEventItemInsertQuery,
      params: [itemId, eventId, ...rest, ignoredByItemId.get(itemId) ? 1 : 0],
    }));
    return DB.transactionSteps([
      ...itemSteps,
      {
        query: 'INSERT INTO last_inventory(timestamp, inventory) VALUES(?, ?)',
        params: [inventoryTimestamp, JSON.stringify(inventory)],
      },
    ]);
  },
  getMatchingItemsCount: async (itemIds: string[]): Promise<number> => {
    if (itemIds.length === 0) {
      return DB.get('SELECT COUNT(1) AS count FROM item WHERE 1 = 0');
    }
    const placeholders = itemIds.map(() => '?').join(', ');
    const query = `SELECT COUNT(1) AS count FROM item WHERE id IN (${placeholders})`;
    return DB.get(query, itemIds);
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
