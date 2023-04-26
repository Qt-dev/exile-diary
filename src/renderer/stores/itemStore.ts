import { makeAutoObservable, runInAction } from 'mobx';
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
    runInAction(() => {
      this.items = lootData.map((item) => new Item(this, item));
      this.isLoading = false;
    });
  }
}
