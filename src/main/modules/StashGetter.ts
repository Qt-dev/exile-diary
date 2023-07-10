import SettingsManager from '../SettingsManager';
import Utils from './Utils';
import GGGAPI from '../GGGAPI';
import { StashTabData } from '../../helpers/types';
import DB from '../db/stashtabs';
import stashTabsManager from '../StashTabsManager';
import RatesGetterV2 from './RateGetterV2';
const EventEmitter = require('events');
const logger = require('electron-log').scope('ShashGetter');
const moment = require('moment');
const ItemParser = require('./ItemParser');
const ItemPricer = require('./ItemPricer');


const emitter = new EventEmitter();
const DefaultInterval = 300;

type ParsedTabData = {
  value: number;
  items: any[];
}

class StashGetter {
  offlineStashChecked: boolean = false;
  nextStashGetTimer?: NodeJS.Timeout;
  previousTimestamp: number = 0;
  constructor() {
  }

  initialize() {
    const settings = SettingsManager.getAll();
    if (settings) {
      // clear any existing scheduled stash check
      if(this.nextStashGetTimer) clearTimeout(this.nextStashGetTimer);

      emitter.removeAllListeners('scheduleNewStashCheck');
      emitter.on('scheduleNewStashCheck', () => {
        this.refreshInterval();
      });
      this.tryGet();
    }
  }

  async refreshInterval() {
    const { interval = DefaultInterval } = SettingsManager.get('netWorthCheck');
    if(this.nextStashGetTimer) clearTimeout(this.nextStashGetTimer);
    // default 5 min between checks
    const newInterval = this.previousTimestamp ? interval - ((moment().unix() - this.previousTimestamp) / 1000) : interval;

    logger.info(`Next net worth check in ${newInterval} seconds`);
    this.nextStashGetTimer = setTimeout(() => {
      this.tryGet();
    }, newInterval * 1000);
  }

  async tryGet() {
    logger.info('Starting the stash tabs refresh');
    const settings = SettingsManager.getAll();
    if (!settings.activeProfile.league) {
      logger.info('No league set (first run?) - returning');
      return;
    }

    if (settings.netWorthCheck && settings.netWorthCheck.enabled === false) {
      logger.info('Net worth checking is disabled ??? - returning');
      return;
    }

    let poeActive = (await Utils.poeRunning()) && !global.afk;
    if (!poeActive) {
      logger.info('PoE not running or in AFK mode - not checking Stash Tabs right now');
      emitter.emit('scheduleNewStashCheck');
      return;
    }

    this.get();
  }

  async checkFullStashInterval() {
    const settings = SettingsManager.getAll();
    if (settings.stashCheck.enabled === false) {
      return false;
    }

    let interval = settings.stashCheck.interval;
    let units = settings.stashCheck.units;
    const latestStashAge = await DB.getLatestStashAge(settings.activeProfile.league);

    switch (units) {
      case 'hours':
        return latestStashAge >= interval;
      case 'maps':
        return await stashTabsManager.hasReachedMapLimit(interval, latestStashAge);
      default:
        logger.info(`Invalid stash check interval: [${interval}] [${units}]`);
        return false;
    }
  }

  async get(interval = 10) {
    const settings = SettingsManager.getAll();
    if (!RatesGetterV2.ratesReady) {
      if (interval > 60) {
        logger.info('Maximum retries exceeded, deferring to next stash getting interval');
      } else {
        logger.info(`Price list not yet ready, retrying in ${interval} seconds`);
        setTimeout(() => {
          this.get(interval + 10);
        }, interval * 1000);
      }
      return;
    }

    let watchedTabs = [];
    if (settings.trackedStashTabs && settings.trackedStashTabs[settings.activeProfile.league]) {
      watchedTabs = settings.trackedStashTabs[settings.activeProfile.league];
      if (watchedTabs.length === 0) {
        emitter.emit('noStashTabsSelected');
        return;
      }
    } else {
      logger.info('Tabs to monitor not yet set, will retrieve none');
      return;
    }

    let getFullStash = await this.checkFullStashInterval();
    const timestamp = moment().format('YYYYMMDDHHmmss');

    const params = {
      league: settings.activeProfile.league,
      trackedStashTabs: watchedTabs,
      accountName: settings.username,
      timestamp: timestamp,
    };

    const tabList = await this.getTabList(params);
    if (!tabList || tabList.length === 0) {
      logger.info('Failed to get tab list, will try again later');
      emitter.emit('scheduleNewStashCheck');
      return;
    }

    const tabs : ParsedTabData = {
      value: 0,
      items: [],
    };

    
    for (const tab of tabList) {
      const tabData = await this.getTabData(tab, params);
      if (tabData && tabData.items && tabData.items.length > 0) {
        //logger.info(`${t.type} "${t.name}" in ${this.league} has total value ${Number(tabData.value)}`);
        tabs.value += Number(tabData.value);
        tabs.items = tabs.items.concat(tabData.items);
      }   
    }

    if (tabs.items.length > 0) {
      const { value: latestStashValue } = await DB.getLatestStashValue(settings.activeProfile.league);
      if (latestStashValue && Number(tabs.value).toFixed(2) === Number(latestStashValue).toFixed(2)) {
        logger.info(
          `No change in ${settings.activeProfile.league} stash value (${Number(tabs.value).toFixed(
            2
          )}) since last update`
        );
        emitter.emit('netWorthUpdated', { value: Number(tabs.value).toFixed(2), change: 0 });
        emitter.emit('scheduleNewStashCheck');
      } else {
        const rawData = await Utils.compress(tabs.items);
        try {
          await DB.insertStashData(timestamp, tabs.value, rawData, settings.activeProfile.league);
          logger.info(
            `Inserted ${settings.activeProfile.league} stash ${timestamp} with value ${tabs.value}`
          );
        } catch (err) {
          logger.info(
            `Error inserting ${settings.activeProfile.league} stash ${timestamp} with value ${tabs.value}: ${err}`
          );
          emitter.emit('scheduleNewStashCheck');
          return;
        }

        try {
          const value = await DB.getPreviousStashValue(timestamp, settings.activeProfile.league);
          let change = 0;
          if (value) {
            change = Number(tabs.value - value);
          }
          if (getFullStash) {
            emitter.emit('stashTabs:updated:full', {
              tabs,
              value: Number(tabs.value).toFixed(2),
              change,
              league: settings.activeProfile.league,
            });
          } else {
            emitter.emit('netWorthUpdated', { value: Number(tabs.value).toFixed(2), change });
          }
          emitter.emit('scheduleNewStashCheck');
        } catch (err) {
          logger.info(
            `Error getting previous ${settings.activeProfile.league} stash before ${timestamp}: ${err}`
          );
          emitter.emit('scheduleNewStashCheck');
        }
      }
    } else {
      logger.info(`No items found in ${settings.activeProfile.league} stash, returning`);
      emitter.emit('scheduleNewStashCheck');
    }
  }
  
  async getNetWorth() {
    const settings = SettingsManager.getAll();
    const { value: latestStashValue, timestamp } = await DB.getLatestStashValue(settings.activeProfile.league);
    const previousStashValue = await DB.getPreviousStashValue(timestamp, settings.activeProfile.league);
    let change = 0;
    if (previousStashValue) {
      change = Number(latestStashValue) - Number(previousStashValue);
    }
    if (latestStashValue) {
      emitter.emit('netWorthUpdated', { value: Number(latestStashValue).toFixed(2), change });
    }
  }

  timer(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  async getTabList(settings) : Promise<StashTabData[]> {
    try {
      const tabs = await GGGAPI.getAllStashTabs();
      const flattenedStashTabs : any[] = [];
      for(const stashTab of tabs) {
        flattenedStashTabs.push(stashTab);
        if(stashTab.children) {
          flattenedStashTabs.push(...stashTab.children);
        }
      }

      logger.info(`trackedStashTabs: ${settings.trackedStashTabs} | ${flattenedStashTabs.filter((tab) => settings.trackedStashTabs.includes(tab.id))}`);
      return settings.trackedStashTabs === null ? [] : flattenedStashTabs.filter((tab) => settings.trackedStashTabs.includes(tab.id));
    } catch (error) {
      logger.error(`Failed to get tabs for ${settings.username} in ${settings.league}: ${error}`);
      return [];
    }
  }

  async getTabData(tab, params) : Promise<ParsedTabData> {
    try {
      const stashTab = await GGGAPI.getStashTab(tab.id);
      const tabData = await this.parseTab(stashTab.items, params.timestamp, tab);
      return tabData;
    } catch (e) {
      logger.error(`Failed to get tab ${tab.index} for ${params.username} in ${params.league}: ${e}`);
      return { value: 0, items: [] };
    }
  }

  async parseTab(items, timestamp, stashTab) : Promise<ParsedTabData> {
    let totalValue = 0;
    const settings = await SettingsManager.getAll();
    const tabItems : any[] = [];

    for(const item of items) {
      const parsedItem = this.parseItem(item, timestamp);
      const price = await ItemPricer.price(parsedItem, settings.activeProfile.league);

      // vendor recipes handled manually
      totalValue += price.isVendor ? 0 : price.value;
      tabItems.push({...item, stashTabId: stashTab.id, stashTabName: stashTab.name, value: price.value});
    };

    return {
      value: Number(totalValue.toFixed(2)),
      items: tabItems,
    };
  }

  parseItem(rawdata, timestamp) {
    const arr = ItemParser.parseItem(rawdata);
    return {
      id: arr[0],
      event_id: timestamp,
      icon: arr[2],
      name: arr[3],
      rarity: arr[4],
      category: arr[5],
      identified: arr[6],
      typeline: arr[7],
      sockets: arr[8],
      stacksize: arr[9],
      rawdata: arr[10],
    };
  }


  async removeAllListeners() {
    emitter.removeAllListeners();
  }

  on(event, listener) {
    emitter.on(event, listener);
  }
}

const stashGetter = new StashGetter();

export default stashGetter;

// module.exports = stashGetter;
// module.exports.emitter = emitter;
