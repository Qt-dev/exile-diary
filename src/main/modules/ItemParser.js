import ItemPricer from './ItemPricer';
import Item from '../models/Item';
const logger = require('electron-log');
const Utils = require('./Utils').default;
const ItemCategoryParser = require('./ItemCategoryParser');
const DB = require('../db/items').default;
const rarities = [
  'Normal',
  'Magic',
  'Rare',
  'Unique',
  'Gem',
  'Currency',
  'Divination Card',
  'Quest Item',
  'Prophecy',
  'Relic',
];

async function insertItems(items, timestamp) {
  const duplicateInventory = await isDuplicateInventory(items);
  if (duplicateInventory) {
    logger.info(`Duplicate items found for ${timestamp}, returning`);
    return;
  } else {
    logger.info(`Inserting items for ${timestamp}`);
    const itemsToInsert = [];
    for(const itemKey in items) {
      const item = new Item(items[itemKey]);
      item.setTimestamp(timestamp);

      const { value } = await ItemPricer.price(item);
      item.setValue(value);
      itemsToInsert.push(item.toDbInsertFormat(timestamp));
    }

    DB.insertItems(itemsToInsert);
  }
}

async function isDuplicateInventory(items) {
  return new Promise((resolve, reject) => {
    var checkDuplicates = false;
    var numItemsToCheck = 0;

    if (items.length === 0) resolve(false);

    var keys = Object.keys(items);
    var query = 'select count(1) as count from items where (';
    for (var i = 0; i < keys.length; i++) {
      if (items[keys[i]].stacksize || items[keys[i]].stackSize) continue;

      if (checkDuplicates) {
        query += ' or ';
      } else {
        checkDuplicates = true;
      }

      query += `( id = '${keys[i]}' `;
      query += `)`;

      numItemsToCheck++;
    }
    query += ')';

    if (!checkDuplicates || numItemsToCheck < 1) {
      resolve(false);
    } else {
      logger.info(query);
      var OldDB = require('./DB').getDB();
      OldDB.get(query, (err, row) => {
        if (err) {
          logger.warn(`Error checking inventory keys: ${err}`);
          resolve(false);
        } else {
          logger.info(`${numItemsToCheck} items in inventory, ${row.count} duplicates found in DB`);
          resolve(row.count === numItemsToCheck);
        }
      });
    }
  });
}

function parseItem(item, timestamp) {
  var id = item.id;
  var icon = getImageUrl(item.icon);
  var name = stripTags(item.name);
  var rarity = rarities[item.frameType];
  var category = ItemCategoryParser.getCategory(item);
  var identified = item.identified;

  var typeline = stripTags(item.typeLine);
  if (rarity === 'Gem' && item.typeLine !== item.baseType) {
    // to handle hybrid gems (general's cry, predator support)
    typeline = stripTags(item.baseType);
  }

  var stacksize = item.stackSize || null;
  var sockets = Utils.getSockets(item);
  var rawdata = JSON.stringify(item);

  return [
    id,
    timestamp,
    icon,
    name,
    rarity,
    category,
    identified ? 1 : 0,
    typeline,
    sockets,
    stacksize,
    rawdata,
  ];
}

function getImageUrl(url) {
  // flask image urls are in a very strange form, just return as is
  if (url.includes('web.poecdn.com/gen')) {
    return url;
  } else {
    // stripping identifier from end
    return url.substring(0, url.indexOf('?'));
  }
}

function stripTags(name) {
  if (!name) {
    return null;
  }
  return name.replace('<<set:MS>><<set:M>><<set:S>>', '');
}

module.exports.insertItems = insertItems;
module.exports.parseItem = parseItem;
