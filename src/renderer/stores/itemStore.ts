import { computed, makeAutoObservable, runInAction } from 'mobx';
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
      this.items = lootData.map((item) => new Item(this, item));
      this.isLoading = false;
    });
  }

  getItemsForLootTable() {
    return this.items.map((item) => item.toLootTable());
  }
  
  // Get the full name to display for an item
  @computed getItemsAbove(value: number): Item[] {
    return this.items.filter((item) => item.value >= value);
  }

}
