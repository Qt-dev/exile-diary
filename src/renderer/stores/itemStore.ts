import { computed, makeAutoObservable, runInAction } from 'mobx';
import { Order } from '../../helpers/types';
import { Item } from './domain/item';

// Mobx store for Items
export default class ItemStore {
  items: Item[] = [];
  isLoading = true;

  constructor(lootData) {
    makeAutoObservable(this);
    this.createItems(lootData);
  }

  createItems(lootData) {
    this.isLoading = true;
    runInAction(() => {
      if (lootData) {
        this.items = lootData.map((item) => new Item(this, item));
      }
      this.isLoading = false;
    });
  }

  groupItemsPerType() {
    const grouped: any[] = [];
    this.items
      .map((item) => item.toLootTable())
      .forEach((item) => {
        const { name, quantity, value, totalValue } = item;
        let group = grouped.find((item) => name === item.name);
        if (!group) {
          group = {
            ...item,
            value: value,
            totalValue: 0,
            quantity: 0,
            items: [],
          };
          grouped.push(group);
        }
        group.totalValue += totalValue;
        group.quantity += quantity;
        group.items.push(item);
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
}
