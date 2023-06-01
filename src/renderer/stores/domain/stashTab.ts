import { makeAutoObservable } from 'mobx';
import { ItemData } from './item';

export type StashTabData = {
  id: string;
  name: string;
  type: string;
  index?: number;
  metadata: {
    public?: boolean;
    folder?: boolean;
    color?: string; // 6 digits hex color
  }
  items?: ItemData[];
};

export class StashTab {
  id: string;
  name: string;
  type: string;
  index?: number;
  metadata: {
    public?: boolean;
    folder?: boolean;
    color?: string; // 6 digits hex color
  }
  items?: ItemData[];
  store = null;

  constructor(store, stashTabData: StashTabData) {
    makeAutoObservable(this, {
      id: false,
      store: false,
    });
    this.id = stashTabData.id;
    this.store = store;
    this.name = stashTabData.name;
    this.type = stashTabData.type;
    this.index = stashTabData.index;
    this.metadata = stashTabData.metadata;
    this.items = stashTabData.items;
  }

  update(stashTabData: StashTabData) {
    this.name = stashTabData.name;
    this.type = stashTabData.type;
    this.index = stashTabData.index;
    this.metadata = stashTabData.metadata;
    this.items = stashTabData.items;
  }
}
