import { computed, makeAutoObservable, runInAction } from 'mobx';
import { Order } from '../../helpers/types';
import { Item } from './domain/item';
import { json2csv } from 'json-2-csv';

// Mobx store for Items
export default class ItemStore {
  items: Item[] = [];
  isLoading = false;
  csv: string = '';

  constructor(lootData) {
    makeAutoObservable(this);
    this.createItems(lootData);
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

  groupItemsPerType() {
    const grouped: any[] = [];
    this.items
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

  // Get the full name to display for an item
  @computed getItemsAbove(value: number): Item[] {
    return this.items.filter((item) => item.value >= value);
  }

  @computed get stats(): any {
    const totalValue = parseFloat(
      this.items
        .filter((item) => item.value !== undefined)
        .reduce((total, item) => total + item.value, 0)
        .toFixed(2)
    );
    const originalValue = parseFloat(
      this.items
        .filter((item) => item.originalValue !== undefined)
        .reduce((total, item) => total + item.originalValue, 0)
        .toFixed(2)
    );
    return {
      items: {
        count: this.items.length,
      },
      value: {
        total: totalValue,
        average: this.items.length ? parseFloat((totalValue / this.items.length).toFixed(2)) : 0,
        original: originalValue,
      },
    };
  }

  @computed async generateCsv(): Promise<void> {
    const baseData = this.items.map((item) => item.toLootTable(true));
    const csv = await json2csv(baseData, {});
    this.csv = csv;
  }

  reset() {
    this.items = [];
  }
}
