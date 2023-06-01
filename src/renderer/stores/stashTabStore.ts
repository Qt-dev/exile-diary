import { makeAutoObservable, runInAction } from 'mobx';
import { StashTab, StashTabData } from './domain/stashTab';
import { electronService } from '../electron.service';
const { logger, ipcRenderer } = electronService;

// Mobx store for Items
export default class StashTabStore {
  stashTabs: StashTab[] = [];
  isLoading = false;

  constructor() {
    makeAutoObservable(this);
  }

  async fetchStashTabs() {
    logger.info('Fetching stash tabs for StashTabStore');
    this.isLoading = true;
    const stashTabs = await ipcRenderer.invoke('get-stash-tabs');
    logger.info(`Found ${stashTabs.length} stash tabs in the backend.`);
    this.createStashTabs(stashTabs);
  }

  createStashTabs(stashTabsData: StashTabData[]) {
    logger.info(`Setting up ${stashTabsData.length} stash tabs in the frontend.`);
    this.isLoading = true;
    runInAction(() => {
      for(const stashTabData of stashTabsData) {
        this.createStashTab(stashTabData);
      }

      this.isLoading = false;
    });
  }

  createStashTab(stashTabData: StashTabData) {
    const existingStashTab = this.stashTabs.find(stashTab => stashTab.id === stashTabData.id);
    if(existingStashTab) {
      existingStashTab.update(stashTabData);
    } else {
      const stashTab = new StashTab(this, stashTabData);
      this.stashTabs.push(stashTab);
    }
  }
}
