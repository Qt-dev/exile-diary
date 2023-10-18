import { computed, makeAutoObservable } from 'mobx';
import { electronService } from '../electron.service';
import ItemStore from './itemStore';
import RunStore from './runStore';
const { logger, ipcRenderer } = electronService;

// Mobx store for Search Data
export default class SearchDataStore {
  itemStore : ItemStore = new ItemStore([]);
  runStore : RunStore = new RunStore(false);
  isLoading = true;
  maxSize = 100; // This can be changed in the future

  constructor() {
    makeAutoObservable(this);
    ipcRenderer.on('search:register-results', (event, data: any) => {
      // logger.info('Search results received', data);
      this.itemStore.createItems(data.items.map((item) => ({ ...item, ...JSON.parse(item.rawdata) })));
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
