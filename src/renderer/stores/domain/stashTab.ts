import { makeAutoObservable } from 'mobx';
import { StashTabData, ItemData } from '../../../helpers/types';
import { electronService } from '../../electron.service';
const { ipcRenderer, logger } = electronService;

const DisabledTypes = [
  'MapStash',
  'UniqueStash'
];

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
  children?: StashTab[];
  disabled: boolean;
  tracked: boolean = false;
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
    this.children = stashTabData.children?.map(child => new StashTab(store, child));
    this.disabled = DisabledTypes.includes(this.type);
    this.tracked = !!stashTabData.tracked;
  }

  update(stashTabData: StashTabData) {
    this.name = stashTabData.name;
    this.type = stashTabData.type;
    this.index = stashTabData.index;
    this.metadata = stashTabData.metadata;
    this.items = stashTabData.items;
    this.disabled = DisabledTypes.includes(this.type);
    this.tracked = !!stashTabData.tracked;
  }

  setTracking(tracked: boolean) {
    if(!this.disabled) {
      this.tracked = tracked;
      const { id, name, type } = this;
      const stashData = {
        id, name, type, tracked
      }
      ipcRenderer.invoke('save-settings:stashtabs', { stashTabs: [stashData] });
    }
  }
}
