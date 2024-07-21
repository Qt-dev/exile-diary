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
  getMatchingItemsCount: async (itemIds: string[]): Promise<number> => {
    const itemQueries: string[] = itemIds.map((id) => `(id = '${id}')`);

    const query = `select count(1) as count from items where (${itemQueries.join(' or ')})`;

    return DB.get(query);
  },
  updateIgnoredItems: async ({ minimumValue, filterPatterns }: any) => {
    logger.debug(`Updating ignored items with minimum value ${minimumValue}`);
    const formattedPatterns = filterPatterns?.map((pattern: string) => `OR LOWER(typeline) LIKE '%${pattern.toLowerCase()}%'\nOR LOWER(name) LIKE '%${pattern.toLowerCase()}%'`);
    const query = `
      UPDATE items
        SET ignored = CASE
          WHEN value < ?
          ${formattedPatterns?.join('\n')}
          THEN 1
          ELSE 0
        END
    `;
    return DB.run(query, [minimumValue]);
  },
};

export default Items;
