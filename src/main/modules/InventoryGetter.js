import GGGAPI from '../GGGAPI';
import KillTracker from './KillTracker';
import DB from '../db';
const logger = require('electron-log');
const dayjs = require('dayjs');
const XPTracker = require('./XPTracker');
const GearChecker = require('./GearChecker');
const EventEmitter = require('events');

var settings;
var emitter = new EventEmitter();

class InventoryGetter extends EventEmitter {
  constructor() {
    super();

    settings = require('./settings').get();

    this.on('xp', XPTracker.logXP);
    this.on('equipment', KillTracker.logKillCount);
    this.on('equipment', GearChecker.check);

    logger.info(`Inventory getter started with query path ${this.queryPath}`);
  }

  /*
   * function name not completely accurate -- does not perform full diff, only gets items added in current inventory
   */
  async getInventoryDiffs(timestamp) {
    return new Promise(async (resolve, reject) => {
      var previnv = await this.getPreviousInventory();
      var currinv = await this.getCurrentInventory(timestamp);
      var diff = await this.compareInventories(previnv, currinv);
      resolve(diff);
    });
  }

  compareInventories(prev, curr) {
    return new Promise((resolve, reject) => {
      //logger.info("Comparing inventories...");

      var prevKeys = Object.keys(prev);
      var currKeys = Object.keys(curr);

      var diff = {};

      currKeys.forEach((key) => {
        if (!prevKeys.includes(key)) {
          diff[key] = curr[key];
        } else {
          var elem = this.compareElements(prev[key], curr[key]);
          if (elem) {
            diff[key] = elem;
          }
        }
      });

      // logger.debug(`Inventory diff: ${JSON.stringify(diff)}`);
      // logger.debug(`Previous inventory: ${JSON.stringify(prev)}`);
      // logger.debug(`Current inventory: ${JSON.stringify(curr)}`);

      this.updateLastInventory(curr);
      resolve(diff);
    });
  }

  compareElements(prev, curr) {
    if (prev.stackSize && curr.stackSize && curr.stackSize > prev.stackSize) {
      var obj = Object.assign({}, curr);
      obj.stackSize -= prev.stackSize;
      return obj;
    } else if (prev.name !== curr.name || prev.typeLine !== curr.typeLine) {
      // for items that transform (fated uniques, upgraded breachstones, etc)
      return curr;
    }
    return null;
  }

  getPreviousInventory() {
    return new Promise((resolve, reject) => {
      DB.all('SELECT timestamp, inventory FROM last_inventory ORDER BY timestamp DESC')
        .then((rows) => {
          if (rows.length === 0) {
            resolve({});
          } else {
            resolve(JSON.parse(rows[0].inventory));
          }
        })
        .catch((err) => {
          logger.info(`Failed to get previous inventory: ${err}`);
          resolve({});
        });
    });
  }

  async getCurrentInventory(timestamp) {
    const data = await GGGAPI.getDataForInventory();
    const inventory = this.getInventory(data.inventory);
    this.emit('xp', timestamp, data.experience);
    this.emit('equipment', timestamp, data.equipment);
    return inventory.mainInventory;
  }

  updateLastInventory(data) {
    var dataString = JSON.stringify(data);
    let timestamp;
    // DB.run('DELETE FROM last_inventory')
    //   .catch((err) => {
    //     logger.info(`Unable to delete last inventory: ${err}`);
    //   })
    //   .then(() => {
      timestamp = dayjs().toISOString();
      return DB.run('INSERT INTO last_inventory(timestamp, inventory) VALUES(?, ?)', [
        timestamp,
        dataString,
      ])
      // })
      .catch((err) => {
        logger.info(`Unable to update last inventory: ${err}`);
      })
      .then(() => {
        logger.info(`Updated last inventory at ${timestamp} (length: ${dataString.length})`);
      });
  }

  getInventory(inventory) {
    var mainInventory = {};
    var equippedItems = {};
    logger.debug(`Parsing inventory for ${inventory?.length} items`);
    logger.debug(inventory);
    inventory?.forEach((item) => {
      if (item.inventoryId === 'MainInventory') {
        mainInventory[item.id] = item;
      } else {
        mainInventory[item.id] = item;
        equippedItems[item.id] = item;
        if (item.socketedItems) {
          for (let i = 0; i < item.socketedItems.length; i++) {
            // this prevents gem swaps from being counted as newly picked up
            let socketedItem = item.socketedItems[i];
            mainInventory[socketedItem.id] = socketedItem;
            equippedItems[socketedItem.id] = socketedItem;
          }
        }
      }
    });
    return {
      mainInventory: mainInventory,
      equippedItems: equippedItems,
    };
  }
}

const inventoryGetter = new InventoryGetter();

module.exports = inventoryGetter;
module.exports.emitter = emitter;
export default inventoryGetter;
