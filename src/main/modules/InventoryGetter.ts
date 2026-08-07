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
let inventoryCaptureQueue: Promise<void> = Promise.resolve();

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
    return this.captureAndPersistInventory(timestamp, async ({ diff, currentInventory }) => {
      await persistDiff(diff);
      await this.updateLastInventory(currentInventory, timestamp);
    });
  }

  async captureAndPersistInventory(
    timestamp: string,
    persistCapture: (capture: {
      diff: Record<string, any>;
      currentInventory: Record<string, any>;
    }) => Promise<void>,
    requireFresh = false
  ) {
    const attempt = inventoryCaptureQueue
      .catch(() => undefined)
      .then(async () => {
        const capture = await this.getInventoryCapture(timestamp, requireFresh);
        await persistCapture(capture);
        return capture.diff;
      });
    inventoryCaptureQueue = attempt.then(
      () => undefined,
      () => undefined
    );
    return attempt;
  }

  async getInventoryCapture(timestamp: string, requireFresh = false) {
    const previousInventory = await this.getPreviousInventory();
    const currentInventory = await this.getCurrentInventory(timestamp, requireFresh);
    const diff = this.compareInventories(previousInventory, currentInventory);
    logger.info(
      `Inventory capture ${timestamp}: previous=${Object.keys(previousInventory).length}, current=${Object.keys(currentInventory).length}, diff=${Object.keys(diff).length}`
    );
    return { diff, currentInventory };
  }

  async getInventoryDiffs(timestamp: string) {
    return this.captureInventoryDiff(timestamp, async () => undefined);
  }

  compareInventories(prev: Record<string, any>, curr: Record<string, any>) {
    const previousKeys = Object.keys(prev);
    const currentKeys = Object.keys(curr);
    const diff: Record<string, any> = {};
    let changedCount = 0;
    let addedCount = 0;

    const missingIds = currentKeys.filter((key) => !key || !curr[key]?.id);
    if (missingIds.length > 0) {
      logger.warn(`Ignoring ${missingIds.length} inventory items without stable IDs`);
    }

    currentKeys.forEach((key) => {
      if (!key || !curr[key]?.id) return;
      if (!previousKeys.includes(key)) {
        diff[key] = curr[key];
        addedCount += 1;
      } else {
        const element = this.compareElements(prev[key], curr[key]);
        if (element) {
          diff[key] = element;
          changedCount += 1;
        }
      }
    });

    const removedCount = previousKeys.filter((key) => !currentKeys.includes(key)).length;
    logger.debug(
      `Inventory diff details: added=${addedCount}, changed=${changedCount}, removed=${removedCount}, identical=${Object.keys(diff).length === 0 && removedCount === 0}`
    );

    return diff;
  }

  compareElements(prev: any, curr: any) {
    const previousQuantity = this.getItemQuantity(prev);
    const currentQuantity = this.getItemQuantity(curr);
    if (previousQuantity !== null && currentQuantity !== null && currentQuantity > previousQuantity) {
      const adjusted = { ...curr };
      adjusted.stackSize = currentQuantity - previousQuantity;
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
        'SELECT id, timestamp, inventory FROM last_inventory ORDER BY timestamp DESC, id DESC'
      );
      if (rows.length === 0) {
        return {};
      }
      logger.debug(
        `Loaded inventory baseline ${rows[0].id} from ${rows[0].timestamp} (${JSON.parse(rows[0].inventory)?.length ?? Object.keys(JSON.parse(rows[0].inventory)).length} items)`
      );
      return JSON.parse(rows[0].inventory);
    } catch (err) {
      logger.info(`Failed to get previous inventory: ${err}`);
      return {};
    }
  }

  async getCurrentInventory(timestamp: string, requireFresh = false) {
    const data = await GGGAPI.getDataForInventory(
      requireFresh ? { fresh: true, throwOnError: true } : undefined
    );
    const inventory = this.getInventory(data.inventory);
    logger.info(
      `Received ${Object.keys(inventory.mainInventory).length} inventory items from ${requireFresh ? 'fresh' : 'cached'} API request`
    );
    this.emit('xp', timestamp, data.experience);
    this.emit('equipment', timestamp, data.equipment);
    const graftblood = GraftbloodTracker.logGraftblood(timestamp, data.equipment);
    this.emit('graftblood', timestamp, graftblood);
    return inventory.mainInventory;
  }

  async updateLastInventory(data: Record<string, any>, timestamp = dayjs().toISOString()) {
    const dataString = JSON.stringify(data);
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

    inventory?.forEach((rawItem) => {
      const item = this.normalizeItem(rawItem);
      if (!item?.id) {
        logger.warn('Ignoring inventory item without a stable ID');
        return;
      }
      if (item.inventoryId === 'MainInventory') {
        mainInventory[item.id] = item;
      } else {
        mainInventory[item.id] = item;
        equippedItems[item.id] = item;

        if (item.socketedItems) {
          for (const rawSocketedItem of item.socketedItems) {
            const socketedItem = this.normalizeItem(rawSocketedItem);
            if (!socketedItem?.id) continue;
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

  getItemQuantity(item: any): number | null {
    const quantity = item?.stackSize ?? item?.stacksize ?? item?.pickupStackSize;
    return typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : null;
  }

  normalizeItem(item: any) {
    if (!item || typeof item !== 'object' || !item.id) return null;
    const quantity = this.getItemQuantity(item);
    return quantity === null ? { ...item } : { ...item, stackSize: quantity };
  }
}

const inventoryGetter = new InventoryGetter();

export { emitter };
export default inventoryGetter;
