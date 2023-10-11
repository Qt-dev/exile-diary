import { computed, makeAutoObservable } from 'mobx';
import { electronService } from '../electron.service';
import ItemStore from './itemStore';
const { logger, ipcRenderer } = electronService;

// Mobx store for Search Data
export default class SearchDataStore {
  itemStore : ItemStore = new ItemStore([]);
  isLoading = true;
  maxSize = 100; // This can be changed in the future

  constructor() {
    makeAutoObservable(this);

    ipcRenderer.on('search:register-results', (event, data: any) => {
      logger.info('Search results received', data);
      this.itemStore.createItems(data.items.map((item) => ({ ...item, ...JSON.parse(item.rawdata) })));
    });
  }

  @computed get json() {
    logger.info('TEST', this.itemStore.items);
    return {
      items: this.itemStore.items,
    };
  }
}
