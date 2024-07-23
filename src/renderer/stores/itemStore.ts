import { computed, makeAutoObservable, runInAction } from 'mobx';
import { Order } from '../../helpers/types';
import { Item } from './domain/item';
import { json2csv } from 'json-2-csv';
import { electronService } from '../electron.service'; 
import { v4 as uuidv4 } from 'uuid';
import Logger from 'electron-log/renderer';
const { registerListener, ipcRenderer  } = electronService;
const logger = Logger.scope('renderer/item-store');

// Mobx store for Items
export default class ItemStore {
  IgnoredStatusUpdateFrequency = 300; // ms to wait before updating the ignore status
  itemsWaitingUpdate: {id: string, status: boolean}[] = [];
  ignoredStatusUpdateTimeout: NodeJS.Timeout | null = null;
  items: Item[] = [];
  isLoading = false;
  csv: string = '';
  id: string;

  constructor(lootData) {
    this.id = uuidv4();
    makeAutoObservable(this);
    this.createItems(lootData);
    registerListener('items:filters:update', this.id , () => {
      logger.debug(`Updating filters for items of store ${this.id}`);
      this.items.forEach((item) => item.updateIgnoredStatus());
    });
    registerListener('prices:updated', this.id , (e, { prices }) => {
      logger.debug(`Updating prices for items of store ${this.id}`);
      this.items.forEach((item) => item.itemId && item.updateValue(prices[item.itemId]));
    });
  }

  updateItemIgnoredStatus(item, ignoredStatus) {
    this.itemsWaitingUpdate.push({id: item.itemId, status: ignoredStatus});
    logger.debug(`Adding item ${item.itemId} to the list of items to update ignore status`);
    if(!this.ignoredStatusUpdateTimeout) {
      this.ignoredStatusUpdateTimeout = setTimeout(() => {
        runInAction(async () => {
          const itemsToSend = JSON.parse(JSON.stringify(this.itemsWaitingUpdate));
          if(itemsToSend.length === 0) return;
          logger.debug(`Updating ${itemsToSend.length} items ignore status`);
          await ipcRenderer.invoke('items:filters:db-update', { data: itemsToSend });
          this.itemsWaitingUpdate = [];
          if(this.ignoredStatusUpdateTimeout) {
            clearTimeout(this.ignoredStatusUpdateTimeout);
            this.ignoredStatusUpdateTimeout = null;
          }
        });
      }, this.IgnoredStatusUpdateFrequency);
    }
  }

  

  createItems(lootData) {
    this.isLoading = true;
    runInAction(async () => {
      if (lootData) {
        this.items = lootData.map((item) => new Item(this, item));
        await this.generateCsv();
      }
      this.isLoading = false;
    });
  }

  groupItemsPerType(ignoredItems : boolean = false) {
    const items = ignoredItems ? this.ignoredItems : this.acceptedItems;
    const grouped: any[] = [];
    items
      .map((item) => item.toLootTable())
      .forEach((item) => {
        const { quantity, value, totalValue, originalValue, stackSize } = item;
        if (stackSize > 0) {
          let group = grouped.find(({ name }) => name === item.name);
          if (!group) {
            group = {
              ...item,
              value: value,
              originalValue: originalValue,
              totalValue: 0,
              quantity: 0,
              items: [],
            };
            grouped.push(group);
          }
          group.totalValue += totalValue;
          group.quantity += quantity;
          group.items.push(item);
        } else {
          let group = grouped.find(({ id }) => id === item.id);
          if (!group) {
            group = {
              ...item,
              value: value,
              originalValue: originalValue,
              totalValue: 0,
              quantity: 0,
              items: [],
            };
            grouped.push(group);
          }
          group.totalValue += totalValue;
          group.quantity += quantity;
          group.items.push(item);
        }
      });
    return grouped;
  }

  @computed getItemsForLootTable(key: string, order: Order) {
    return this.groupItemsPerType().sort((a, b) => {
      let first = a;
      let second = b;
      if (order === 'asc') {
        first = b;
        second = a;
      }
      if (typeof second[key] === 'string') {
        return second[key].localeCompare(first[key]);
      } else {
        return second[key] > first[key] ? 1 : -1;
      }
    });
  }

  @computed getIgnoredItemsForLootTable(key: string, order: Order) {
    return this.groupItemsPerType(true).sort((a, b) => {
      let first = a;
      let second = b;
      if (order === 'asc') {
        first = b;
        second = a;
      }
      if (typeof second[key] === 'string') {
        return second[key].localeCompare(first[key]);
      } else {
        return second[key] > first[key] ? 1 : -1;
      }
    });
  }

  // Get the full name to display for an item
  @computed getItemsAbove(value: number): Item[] {
    return this.items.filter((item) => item.value >= value);
  }

  @computed get acceptedItems(): Item[] {
    return this.items.filter((item) => !item.isIgnored);
  }

  @computed get ignoredItems(): Item[] {
    return this.items.filter((item) => item.isIgnored);
  }

  @computed get stats(): any {
    const totalValue = parseFloat(
      this.acceptedItems
        .filter((item) => item.value !== undefined)
        .reduce((total, item) => total + item.value, 0)
        .toFixed(2)
    );
    const originalValue = parseFloat(
      this.acceptedItems
        .filter((item) => item.originalValue !== undefined)
        .reduce((total, item) => total + item.originalValue, 0)
        .toFixed(2)
    );
    return {
      items: {
        count: this.acceptedItems.length,
      },
      value: {
        total: totalValue,
        average: this.acceptedItems.length ? parseFloat((totalValue / this.acceptedItems.length).toFixed(2)) : 0,
        original: originalValue,
      },
    };
  }

  @computed async generateCsv(): Promise<void> {
    const baseData = this.acceptedItems.map((item) => item.toLootTable(true));
    const csv = await json2csv(baseData, {});
    this.csv = csv;
  }

  @computed get value(): number {
    return this.acceptedItems.reduce((total, item) => total + item.value, 0);
  }

  reset() {
    this.items = [];
  }
}
