import { computed, makeAutoObservable, runInAction } from 'mobx';
import { StashTab, StashTabSettings } from './domain/stashTab';
import { StashTabData } from '../../helpers/types';
import { electronService } from '../electron.service';
import ItemStore from './itemStore';
const { logger, ipcRenderer } = electronService;

// Mobx store for Items
export default class StashTabStore {
  stashTabs: StashTab[] = [];
  isLoading = false;
  itemStore: ItemStore = new ItemStore([]);
  value: number = 0;

  constructor() {
    makeAutoObservable(this);
  }

  async fetchStashTabs() {
    logger.info('Fetching stash tabs for StashTabStore');
    this.isLoading = true;
    const { stashTabs, data } = await ipcRenderer.invoke('get-stash-tabs');
    this.createStashTabs(stashTabs);
    this.itemStore.createItems(data.items);
    this.value = data.value;

    ipcRenderer.on('stashTabs:frontend:update', (event, stashTabsData) => {
      const tabs = stashTabsData.tabs;
      logger.info(
        `Received stash tabs update from backend for ${tabs.length} stash tabs.`
      );
      this.itemStore.createItems(tabs.items);
      this.value = tabs.value;
    });
  }

  @computed getStashTab(id: string) {
    const stashTab = this.flattenedStashTabs.find((stashTab) => stashTab.id === id);
    return stashTab ?? null;
  }

  get flattenedStashTabs() {
    const output: StashTab[] = [];
    for (const stashTab of this.stashTabs) {
      output.push(stashTab);
      if (stashTab.children) {
        output.push(...stashTab.children);
      }
    }
    return output;
  }

  get trackedStashTabs() {
    return this.flattenedStashTabs.filter((stashTab) => stashTab.tracked);
  }

  createStashTabs(stashTabsData: StashTabData[]) {
    logger.info(`Setting up ${stashTabsData.length} stash tabs in the frontend.`);
    this.isLoading = true;
    runInAction(() => {
      for (const stashTabData of stashTabsData) {
        this.createStashTab(stashTabData);
      }
      this.isLoading = false;
    });
  }

  createStashTab(stashTabData: StashTabData) {
    const existingStashTab = this.stashTabs.find((stashTab) => stashTab.id === stashTabData.id);
    if (existingStashTab) {
      existingStashTab.update(stashTabData);
    } else {
      const stashTab = new StashTab(this, stashTabData);
      this.stashTabs.push(stashTab);
    }
  }

  getTrackedStashTabs() {
    const output = {};
    for (const stashTab of this.stashTabs) {
      output[stashTab.id] = stashTab.tracked;
    }
    return output;
  }

  saveTrackedStashTabs() {
    const formattedStashTabsSettings: StashTabSettings[] = this.flattenedStashTabs
      .filter((stashTab) => stashTab.tracked)
      .map((stashTab) => stashTab.formattedForSettings());
    ipcRenderer.invoke('save-settings:stashtabs', { stashTabs: formattedStashTabsSettings });
  }
}
