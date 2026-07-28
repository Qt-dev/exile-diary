import EventEmitter from 'events';
import dayjs from 'dayjs';
import logger from 'electron-log';
import GGGAPI from '../GGGAPI';
import DB from '../db';
import XPTracker from './XPTracker';
import GraftbloodTracker from './GraftbloodTracker';
import KillTracker from './KillTracker';
import settingsRepository from './settings';
import * as GearChecker from './GearChecker';

let settings: any;
const emitter = new EventEmitter();

class InventoryGetter extends EventEmitter {
  constructor() {
    super();

    settings = settingsRepository.get();

    if (typeof XPTracker.logXP === 'function') {
      this.on('xp', XPTracker.logXP);
    }
    if (typeof KillTracker.logKillCount === 'function') {
      this.on('equipment', KillTracker.logKillCount);
    }
    if (typeof GearChecker.check === 'function') {
      this.on('equipment', GearChecker.check);
    }

    logger.info('Inventory getter started');
  }

  async captureInventoryDiff(
    timestamp: string,
    persistDiff: (diff: Record<string, any>) => Promise<void>
  ) {
    const previousInventory = await this.getPreviousInventory();
    const currentInventory = await this.getCurrentInventory(timestamp);
    const diff = this.compareInventories(previousInventory, currentInventory);
    await persistDiff(diff);
    await this.updateLastInventory(currentInventory);
    return diff;
  }

  async getInventoryDiffs(timestamp: string) {
    return this.captureInventoryDiff(timestamp, async () => undefined);
  }

  compareInventories(prev: Record<string, any>, curr: Record<string, any>) {
    const previousKeys = Object.keys(prev);
    const currentKeys = Object.keys(curr);
    const diff: Record<string, any> = {};

    currentKeys.forEach((key) => {
      if (!previousKeys.includes(key)) {
        diff[key] = curr[key];
      } else {
        const element = this.compareElements(prev[key], curr[key]);
        if (element) {
          diff[key] = element;
        }
      }
    });

    return diff;
  }

  compareElements(prev: any, curr: any) {
    if (prev.stackSize && curr.stackSize && curr.stackSize > prev.stackSize) {
      const adjusted = { ...curr };
      adjusted.stackSize -= prev.stackSize;
      return adjusted;
    }

    if (prev.name !== curr.name || prev.typeLine !== curr.typeLine) {
      return curr;
    }

    return null;
  }

  async getPreviousInventory() {
    try {
      const rows = await DB.all(
        'SELECT timestamp, inventory FROM last_inventory ORDER BY timestamp DESC'
      );
      if (rows.length === 0) {
        return {};
      }
      return JSON.parse(rows[0].inventory);
    } catch (err) {
      logger.info(`Failed to get previous inventory: ${err}`);
      return {};
    }
  }

  async getCurrentInventory(timestamp: string) {
    const data = await GGGAPI.getDataForInventory();
    const inventory = this.getInventory(data.inventory);
    this.emit('xp', timestamp, data.experience);
    this.emit('equipment', timestamp, data.equipment);
    const graftblood = GraftbloodTracker.logGraftblood(timestamp, data.equipment);
    this.emit('graftblood', timestamp, graftblood);
    return inventory.mainInventory;
  }

  async updateLastInventory(data: Record<string, any>) {
    const dataString = JSON.stringify(data);
    const timestamp = dayjs().toISOString();

    try {
      await DB.run('INSERT INTO last_inventory(timestamp, inventory) VALUES(?, ?)', [
        timestamp,
        dataString,
      ]);
      logger.info(`Updated last inventory at ${timestamp} (length: ${dataString.length})`);
    } catch (err) {
      logger.info(`Unable to update last inventory: ${err}`);
    }
  }

  getInventory(inventory: any[]) {
    const mainInventory: Record<string, any> = {};
    const equippedItems: Record<string, any> = {};
    logger.debug(`Parsing inventory for ${inventory?.length} items`);
    logger.silly(inventory);

    inventory?.forEach((item) => {
      if (item.inventoryId === 'MainInventory') {
        mainInventory[item.id] = item;
      } else {
        mainInventory[item.id] = item;
        equippedItems[item.id] = item;

        if (item.socketedItems) {
          for (const socketedItem of item.socketedItems) {
            mainInventory[socketedItem.id] = socketedItem;
            equippedItems[socketedItem.id] = socketedItem;
          }
        }
      }
    });

    return {
      mainInventory,
      equippedItems,
    };
  }
}

const inventoryGetter = new InventoryGetter();

export { emitter };
export default inventoryGetter;
