import ItemPricer from './ItemPricer';
import Item from '../models/Item';
import IgnoreManager from '../../helpers/ignoreManager';
const logger = require('electron-log');
const DB = require('../db/items').default;

async function insertItems(items, timestamp, eventId) {
  const duplicateInventory = await isDuplicateInventory(items);
  if (duplicateInventory) {
    logger.info(`Duplicate items found for ${timestamp}, returning`);
    return;
  } else {
    logger.info(`Inserting items for ${timestamp}`);
    const itemsToInsert = [];
    const formattedItemsForIgnoreManager = [];
    for (const itemKey in items) {
      const item = new Item(items[itemKey]);
      item.setTimestamp(timestamp);

      const { value, explanation } = await ItemPricer.price(item);
      item.setValue(value);
      item.setValuation(explanation);
      itemsToInsert.push(item.toDbInsertFormat(timestamp));

      formattedItemsForIgnoreManager.push({
        id: item.id,
        status: IgnoreManager.isItemIgnored(item),
      });
    }

    await DB.insertItems(itemsToInsert, eventId);
    await DB.updateIgnoredItems(formattedItemsForIgnoreManager);
  }
}

async function insertItemsAndInventoryBaseline(
  items,
  timestamp,
  eventId,
  inventoryTimestamp,
  currentInventory
) {
  const duplicateInventory = await isDuplicateInventory(items);
  const itemsToInsert = [];
  const formattedItemsForIgnoreManager = [];

  if (duplicateInventory) {
    logger.info(`Duplicate items found for ${timestamp}, advancing inventory baseline only`);
  } else {
    logger.info(`Inserting items and inventory baseline for ${timestamp}`);
    for (const itemKey in items) {
      const item = new Item(items[itemKey]);
      item.setTimestamp(timestamp);

      const { value, explanation } = await ItemPricer.price(item);
      item.setValue(value);
      item.setValuation(explanation);
      itemsToInsert.push(item.toDbInsertFormat(timestamp));
      formattedItemsForIgnoreManager.push({
        id: item.id,
        status: IgnoreManager.isItemIgnored(item),
      });
    }
  }

  await DB.insertItemsAndInventory(
    itemsToInsert,
    eventId,
    inventoryTimestamp,
    currentInventory,
    formattedItemsForIgnoreManager
  );
}

async function isDuplicateInventory(items) {
  if (items.length === 0) return false;

  const itemIds = [];

  for (const itemKey in items) {
    const item = items[itemKey];
    if (!item.stacksize && !item.stackSize) {
      itemIds.push(item.id);
    }
  }

  if (itemIds.length === 0) return false;

  const { count: matchingItemsCount } = await DB.getMatchingItemsCount(itemIds);

  logger.info(`${itemIds.length} items in inventory, ${matchingItemsCount} duplicates found in DB`);
  return matchingItemsCount === itemIds.length;
}

module.exports.insertItems = insertItems;
module.exports.insertItemsAndInventoryBaseline = insertItemsAndInventoryBaseline;
export default { insertItems, insertItemsAndInventoryBaseline };
