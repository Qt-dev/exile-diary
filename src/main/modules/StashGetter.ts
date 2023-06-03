import SettingsManager from '../SettingsManager';
import Utils from './Utils';
import GGGAPI from '../GGGAPI';
import { StashTabData } from '../../helpers/types';
import DB from '../db/stashtabs';
import stashTabsManager from '../StashTabsManager';
const EventEmitter = require('events');
const logger = require('electron-log');
const moment = require('moment');
const ItemParser = require('./ItemParser');
const ItemPricer = require('./ItemPricer');
const RateGetterV2 = require('./RateGetterV2').Getter;

var emitter = new EventEmitter();

type ParsedTabData = {
  value: number;
  items: any[];
}

class StashGetter {
  offlineStashChecked: boolean = false;
  nextStashGetTimer?: NodeJS.Timeout;
  constructor() {}

  initialize() {
    const settings = SettingsManager.getAll();
    if (settings) {
      // clear any existing scheduled stash check
      clearTimeout(this.nextStashGetTimer);

      emitter.removeAllListeners('scheduleNewStashCheck');
      emitter.on('scheduleNewStashCheck', () => {
        clearTimeout(this.nextStashGetTimer);
        // default 5 min between checks
        let interval = 300;
        if (settings.netWorthCheck && settings.netWorthCheck.interval) {
          interval = settings.netWorthCheck.interval;
        }
        if (!this.offlineStashChecked) {
          logger.info(`Next net worth check in ${interval} seconds`);
          this.nextStashGetTimer = setTimeout(() => {
            this.tryGet();
          }, interval * 1000);
        }
      });
    }
  }

  async tryGet() {
    const settings = SettingsManager.getAll();
    if (!settings.league) {
      logger.info('No league set (first run?) - returning');
      return;
    }

    if (settings.netWorthCheck && settings.netWorthCheck.enabled === false) {
      logger.info('Net worth checking is disabled ??? - returning');
      return;
    }

    let poeActive = (await Utils.poeRunning()) && !global.afk;
    if (!poeActive) {
      if (this.offlineStashChecked) {
        emitter.emit('scheduleNewStashCheck');
        return;
      } else {
        logger.info('PoE not running or in AFK mode - suspending net worth check temporarily');
        this.offlineStashChecked = true;
      }
    } else {
      this.offlineStashChecked = false;
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
    if (!RateGetterV2.ratesReady) {
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
    if (settings.trackedTabs && settings.trackedTabs[settings.activeProfile.league]) {
      watchedTabs = settings.trackedTabs[settings.activeProfile.league];
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
      tabs: watchedTabs,
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
      const { value: latestStashValue } = await DB.getLatestStashValue();
      if (latestStashValue && Number(tabs.value).toFixed(2) === Number(latestStashValue.value).toFixed(2)) {
        logger.info(
          `No change in ${settings.activeProfile.league} stash value (${Number(tabs.value).toFixed(
            2
          )}) since last update`
        );
        emitter.emit('netWorthUpdated');
        emitter.emit('scheduleNewStashCheck');
      } else {
        const rawData = getFullStash ? await Utils.compress(tabs.items) : '{}';
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
          if (getFullStash) {
            let change =
              value ? Number(tabs.value - value).toFixed(2) : 'new';
            emitter.emit('fullStashUpdated', {
              value: Number(tabs.value).toFixed(2),
              change: change,
              league: settings.activeProfile.league,
            });
          } else {
            emitter.emit('netWorthUpdated');
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

  timer(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  async getTabList(settings) : Promise<StashTabData[]> {
    try {
      const { tabs } = await GGGAPI.getAllStashTabs();
      return settings.tabs === null ? [] : tabs.filter((tab) => settings.tabs.includes(tab.id));
    } catch (error) {
      logger.error(`Failed to get tabs for ${settings.username} in ${settings.league}: ${error}`);
      return [];
    }
  }

  async getTabData(tab, params) : Promise<ParsedTabData> {
    try {
      const stashTab = await GGGAPI.getStashTab(tab.id);
      const tabData = await this.parseTab(stashTab.items, params.timestamp);
      return tabData;
    } catch (e) {
      logger.error(`Failed to get tab ${tab.index} for ${params.username} in ${params.league}: ${e}`);
      return { value: 0, items: [] };
    }
  }

  async parseTab(items, timestamp) : Promise<ParsedTabData> {
    let totalValue = 0;
    const settings = await SettingsManager.getAll();
    const tabItems : any[] = [];

    for(const item of items) {
      const parsedItem = this.parseItem(item, timestamp);
      const value = await ItemPricer.price(parsedItem, settings.activeProfile.league);

      // vendor recipes handled manually
      totalValue += value.isVendor ? 0 : value;
      tabItems.push(item);
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
}

const stashGetter = new StashGetter();

module.exports = stashGetter;
module.exports.emitter = emitter;
