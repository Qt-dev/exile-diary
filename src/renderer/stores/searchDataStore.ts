import { computed, makeAutoObservable } from 'mobx';
import { electronService } from '../electron.service';
import ItemStore from './itemStore';
import RunStore from './runStore';
const { ipcRenderer } = electronService;

// Mobx store for Search Data
export default class SearchDataStore {
  itemStore: ItemStore = new ItemStore([]);
  runStore: RunStore = new RunStore(false);
  runStoreCsv: String = '';
  isLoading = true;
  maxSize = 100; // This can be changed in the future

  constructor() {
    makeAutoObservable(this);
    ipcRenderer.on('search:register-results', async (event, data: any) => {
      this.itemStore.createItems(
        data.items.map((item) => ({ ...item, ...JSON.parse(item.rawdata) }))
      );
      this.runStore.createRuns(data.runs);
    });
  }

  @computed get json() {
    return {
      items: this.itemStore.items,
      runs: this.runStore.runs,
    };
  }

  reset() {
    this.itemStore.reset();
    this.runStore.reset();
  }
}
