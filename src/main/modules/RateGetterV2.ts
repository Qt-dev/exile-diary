import RendererLogger from '../RendererLogger';
import SettingsManager from '../SettingsManager';
import Logger from 'electron-log';
import Axios from 'axios';
import { buildMemoryStorage, setupCache } from 'axios-cache-interceptor/dev';
import Bottleneck from 'bottleneck';
import DB from '../db/rates';

const EventEmitter = require('events');
const dayjs = require('dayjs');
const logger = Logger.scope('RateGetter');
const NINJA_CACHE_TIME_IN_SECONDS = 10;
const NINJA_MIN_TIME_BETWEEN_REQUESTS = 350;
const ninjaInstance = Axios.create({
  baseURL: 'https://poe.ninja',
});
const ninjaStorage = buildMemoryStorage();
const ninjaAxios = setupCache(ninjaInstance, {
  enabled: true,
  ttl: 1000 * NINJA_CACHE_TIME_IN_SECONDS,
  storage: ninjaStorage,
  interpretHeader: false,
  vary: false,
  debug: logger.debug.bind(logger),
});
const MAX_RETRY_ATTEMPTS = 10;
const ninjaLimiters = new Bottleneck.Group({
  maxConcurrent: 1,
  minTime: NINJA_MIN_TIME_BETWEEN_REQUESTS,
});

export function normalizeNinjaLeagueName(league: string) {
  const normalized = league.trim();
  const lowercaseLeague = normalized.toLowerCase();

  if (lowercaseLeague === 'allflame' || lowercaseLeague === 'curse of the allflame') {
    return 'Allflame';
  }

  if (
    lowercaseLeague === 'hardcore allflame' ||
    lowercaseLeague === 'hardcore curse of the allflame'
  ) {
    return 'Hardcore Allflame';
  }

  return normalized;
}

ninjaLimiters.on('created', (limiter, key) => {
  logger.info(`Limiter created: ${limiter.id}. Setting up listeners for ${key} group.`);

  limiter.on('done', (jobInfo) => {
    logger.debug(`poe.ninja request ${jobInfo.options.id} done.`);
  });

  limiter.on('executing', (jobInfo) => {
    logger.debug(`poe.ninja request ${jobInfo.options.id} started.`);
  });

  limiter.on('queued', (jobInfo) => {
    logger.debug(`poe.ninja request ${jobInfo.options.id} queued.`);
  });

  limiter.on('failed', (error, jobInfo) => {
    logger.error(`poe.ninja request ${jobInfo.options.id} failed with error: ${error}`);
    if (jobInfo.retryCount < MAX_RETRY_ATTEMPTS) {
      logger.info(
        `Retrying poe.ninja request ${jobInfo.options.id}. Retry count: ${jobInfo.retryCount + 1}`
      );
    }
  });
});

const rateTypes = {
  Currency: cleanCurrencyData,
  Fragment: cleanCurrencyData,
  Scarab: cleanCurrencyData,

  Tattoo: cleanCurrencyData,
  Omen: cleanCurrencyData,
  DivinationCard: cleanCurrencyData,
  Artifact: cleanCurrencyData,
  Oil: cleanCurrencyData,
  Incubator: cleanCurrencyData,

  UniqueWeapon: cleanItemData,
  UniqueArmour: cleanItemData,
  UniqueAccessory: cleanItemData,
  UniqueJewel: cleanItemData,
  UniqueFlask: cleanItemData,
  UniqueRelic: cleanItemData,
  SkillGem: cleanItemData,

  ClusterJewel: cleanItemData,

  Map: cleanMaps,
  BlightedMap: cleanMaps,
  BlightRavagedMap: cleanMaps,
  // ScourgedMap: cleanMaps, // No Scourged map around nowadays
  UniqueMap: cleanUniqueMaps,
  DeliriumOrb: cleanCurrencyData,
  Invitation: cleanCurrencyData,
  Memory: cleanCurrencyData,

  BaseType: cleanBaseTypesData,
  Fossil: cleanCurrencyData,
  Resonator: cleanCurrencyData,
  // HelmetEnchant: cleanEnchants,
  Beast: cleanCurrencyData,
  Essence: cleanCurrencyData,
  Vial: cleanCurrencyData,

  Wombgift: cleanWombgift,
  // KalguuranRune: cleanNameValuePairs,
  // AllflameEmber: cleanNameValuePairs,
  // Coffin: cleanByModAndLevel,
  // Old Categories
  // "Prophecy" : cleanNameValuePairs,
  // "Watchstone" : cleanWatchstones,
  // RIP harvest :-(
  // "Seed" : cleanSeeds
};

const specialGems = ['Empower Support', 'Enlighten Support', 'Enhance Support'];
var nextRateGetTimer;
var emitter = new EventEmitter();

class RateGetterV2 {
  ratesReady: boolean = false;
  isUpdating: boolean = false;
  postUpdateCallback: Function = () => {};
  constructor() {
    if (nextRateGetTimer) clearTimeout(nextRateGetTimer);
  }

  on(event, listener) {
    emitter.on(event, listener);
  }

  removeAllListeners() {
    emitter.removeAllListeners();
  }

  initialize({ postUpdateCallback } = { postUpdateCallback: () => {} }) {
    this.update();
    this.postUpdateCallback = postUpdateCallback;
  }

  getLeagueName(useOverride = true) {
    const activeProfile = SettingsManager.get('activeProfile');
    let league = activeProfile.league;

    if (useOverride && activeProfile.leagueOverride && activeProfile.leagueOverride.length > 0) {
      league = activeProfile.leagueOverride;
    } else if (
      activeProfile.league &&
      activeProfile.league.includes('SSF') &&
      activeProfile &&
      activeProfile.overrideSSF
    ) {
      // override ssf and get item prices from corresponding trade league
      // TODO undocumented league naming convention change in 3.13... must check this every league from now on
      // as of 3.13 "SSF Ritual HC" <--> "Hardcore Ritual"
      league = activeProfile.league.replace('SSF', '').trim();
      if (league.includes('HC')) {
        league = 'Hardcore ' + league.replace('HC', '').trim();
      }
    }

    return league;
  }

  getNinjaLeagueName() {
    return normalizeNinjaLeagueName(this.getLeagueName());
  }

  async setIsUpdating(isUpdating) {
    this.isUpdating = isUpdating;
    if (!isUpdating) {
      emitter.emit('UpdateDone');
    }
  }

  async waitForUpdate() {
    return new Promise<void>((resolve) => {
      if (!this.isUpdating) {
        resolve();
      } else {
        emitter.once('UpdateDone', () => {
          resolve();
        });
      }
    });
  }

  /*
   * get today's rates from POE.ninja
   */
  async update(isForced = false) {
    if (this.isUpdating) {
      logger.error('Already fetching rates for the day, aborting the new request');
      return this.waitForUpdate();
    }
    try {
      this.setIsUpdating(true);
      const activeProfile = SettingsManager.get('activeProfile');
      // const privateLeaguePriceMaps = SettingsManager.get('privateLeaguePriceMaps');
      if (!activeProfile) {
        logger.error('No settings found, will not attempt to get prices');
        return;
      }
      if (!activeProfile.league) {
        logger.info('No league set, will not attempt to get prices');
        return;
      }

      // no need for exchange rates in SSF
      if (activeProfile.league.includes('SSF') && !activeProfile.overrideSSF) {
        return;
      }

      // if (Utils.isPrivateLeague(activeProfile.league)) {
      //   // TODO: Fix this part with private leagues
      //   if (privateLeaguePriceMaps && privateLeaguePriceMaps[activeProfile.league]) {
      //     logger.info(
      //       `Private league ${activeProfile.league} will use prices from ${
      //         privateLeaguePriceMaps[activeProfile.league]
      //       }`
      //     );
      //     activeProfile.league = privateLeaguePriceMaps[activeProfile.league];
      //   } else {
      //     logger.info(
      //       `No price map set for private league ${activeProfile.league}, will not attempt to get prices`
      //     );
      //     return;
      //   }
      // }

      const today = dayjs().format('YYYYMMDD');
      const hasExisting = await this.hasExistingRates(today);

      if (hasExisting) {
        logger.info(`Found existing ${activeProfile.league} rates for ${today}`);

        if (!isForced) {
          this.scheduleNextUpdate();
          this.ratesReady = true;
          return;
        } else {
          logger.info('Forced update, cleaning existing rates');
          await this.cleanRates(today);
        }
      }

      emitter.emit('gettingPrices');
      logger.info(`Getting new ${activeProfile.league} rates for ${today}`);
      const message = {
        text: `Getting new ${activeProfile.league} rates for today (${today})`,
      };
      RendererLogger.log({ messages: [message] });
      await this.getRates(today, !isForced);
      RendererLogger.log({
        messages: [
          { text: 'Finished getting rates for the' },
          { text: ` ${activeProfile.league} league`, type: 'important' },
          { text: ' for' },
          { text: ` today (${today})`, type: 'important' },
        ],
      });
    } finally {
      this.setIsUpdating(false);
      this.postUpdateCallback();
    }
  }

  async cleanRates(date) {
    return DB.cleanRates(this.getLeagueName(), date);
  }

  scheduleNextUpdate() {
    // schedule next rate update at 10 seconds after midnight
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 10);
    const interval = next.valueOf() - Date.now();
    logger.info(`Set new timer for updating prices in ${Number(interval / 1000).toFixed(2)} sec`);

    if (nextRateGetTimer) clearTimeout(nextRateGetTimer);
    nextRateGetTimer = setTimeout(() => {
      logger.info('Executing scheduled rate update');
      this.update();
    }, interval);
  }

  async getRates(date, useCache = true) {
    const tempRates = {};
    const { useGzip = true, getLowConfidence = false } = SettingsManager.getAll();

    try {
      for (const rateType in rateTypes) {
        let data;
        logger.info(`Getting prices for item type ${rateType}`);
        try {
          data = await getNinjaData(this.getNinjaURL(rateType), useGzip, useCache);
          const processRateType = rateTypes[rateType];
          tempRates[rateType] = processRateType(data, getLowConfidence);
        } catch (err) {
          logger.error(`Error in getting POE data for ${rateType}`);
          logger.error(err);
        }
      }
      // require('fs/promises').writeFile('./tempRates.json', JSON.stringify(tempRates, null, 2), 'utf8');
      logger.info('Finished getting prices from poe.ninja, processing now');
    } catch (e) {
      logger.info('Error getting rates: ' + e);
      emitter.emit('gettingPricesFailed');
      return;
    }

    const rates = {};
    rates['UniqueItem'] = Object.assign(
      tempRates['UniqueJewel'],
      tempRates['UniqueFlask'],
      tempRates['UniqueWeapon'],
      tempRates['UniqueArmour'],
      tempRates['UniqueAccessory']
    );
    rates['Currency'] = Object.assign(
      tempRates['Currency'],
      tempRates['Oil'],
      tempRates['DeliriumOrb'],
      tempRates['Incubator'],
      tempRates['Fossil'],
      tempRates['Resonator'],
      tempRates['Essence'],
      tempRates['Vial'],
      tempRates['Artifact']
    );
    rates['Wombgift'] = tempRates['Wombgift'];
    rates['ClusterJewel'] = tempRates['ClusterJewel'];
    rates['Fragment'] = Object.assign(tempRates['Fragment'], tempRates['Scarab']);
    rates['DivinationCard'] = tempRates['DivinationCard'];
    rates['SkillGem'] = tempRates['SkillGem'];
    rates['BaseType'] = tempRates['BaseType'];
    rates['HelmetEnchant'] = tempRates['HelmetEnchant'];
    rates['UniqueMap'] = tempRates['UniqueMap'];
    rates['Map'] = Object.assign(
      tempRates['Map'],
      tempRates['BlightedMap'],
      tempRates['BlightRavagedMap']
    );
    rates['Memory'] = tempRates['Memory'];
    rates['Invitation'] = tempRates['Invitation'];
    rates['Tattoo'] = tempRates['Tattoo'];
    rates['Omen'] = tempRates['Omen'];
    // rates['KalguuranRune'] = tempRates['KalguuranRune'];

    // Necropolis
    // rates['Coffin'] = tempRates['Coffin'];
    // rates['AllflameEmber'] = tempRates['AllflameEmber'];

    // Retired data
    // rates['Watchstone'] = tempRates['Watchstone'];
    // rates['Seed'] = tempRates['Seed'];
    // rates['Prophecy'] = tempRates['Prophecy'];
    // require('fs/promises').writeFile('./rates.json', JSON.stringify(rates, null, 2), 'utf8');

    const ratesWereUpdated = await DB.insertRates(this.getLeagueName(false), date, rates);
    if (!ratesWereUpdated) {
      emitter.emit('gettingPricesFailed');
      return;
    } else {
      emitter.emit('doneGettingPrices');
      this.ratesReady = true;
      this.scheduleNextUpdate();
    }
  }

  getNinjaURL(category) {
    var url = '';
    switch (category) {
      case 'Currency':
      case 'Fragment':
      case 'Scarab':
      case 'Tattoo':
      case 'Omen':
      case 'DivinationCard':
      case 'Artifact':
      case 'Oil':
      case 'Incubator':
      case 'DeliriumOrb':
      case 'Invitation':
      case 'Memory': // TODO: Fix pricing
      case 'Fossil':
      case 'Resonator':
      case 'Beast':
      case 'Essence':
      case 'Vial':
        url = `/poe1/api/economy/exchange/current/overview?type=${category}`;
        break;
      case 'Wombgift':
      case 'UniqueWeapon':
      case 'UniqueArmour':
      case 'UniqueAccessory':
      case 'UniqueJewel':
      case 'UniqueFlask':
      case 'UniqueRelic':
      case 'SkillGem':
      case 'ClusterJewel':
      case 'Map':
      case 'BlightedMap':
      case 'BlightRavagedMap':
      case 'UniqueMap':
      case 'BaseType':
        url = `/poe1/api/economy/stash/current/item/overview?type=${category}`;
        break;

      // Old stuff using old APIs
      case 'ScourgedMap': // TODO: Add pricing
        // case 'KalguuranRune':

        // RETIRED
        // case 'AllflameEmber':
        // case 'Coffin':
        // case 'Prophecy':
        // case 'Watchstone':
        // case 'Seed':
        // case 'HelmetEnchant':
        url = `/api/data/itemoverview?type=${category}`;
        break;
      default:
        throw new Error(`Invalid poe.ninja category [${category}]`);
    }

    return `${url}&league=${encodeURIComponent(this.getNinjaLeagueName())}`;
  }

  hasExistingRates(date) {
    return DB.hasExistingRates(this.getLeagueName(), date);
  }
}

async function getNinjaData(path, useGzip, useCache = true) {
  const limiter = ninjaLimiters.key('poe.ninja-rates');
  const requestId = path.replace(/[^a-zA-Z0-9]/g, '-');

  return limiter.schedule({ id: requestId }, async () => {
    logger.info(`Requesting poe.ninja data from ${path}`);

    const response: any = await ninjaAxios({
      url: path,
      method: 'GET',
      timeout: useGzip ? 10000 : 30000,
      headers: {
        'Accept-Encoding': useGzip ? 'gzip' : 'identity',
      },
      cache: useCache
        ? {
            enabled: true,
            ttl: 1000 * NINJA_CACHE_TIME_IN_SECONDS,
          }
        : false,
    });

    logger.info(
      `${response.cached ? 'Using cached' : 'Using fresh'} poe.ninja response for ${path}`
    );

    return response.data;
  });
}

function cleanBaseTypesData(arr, getLowConfidence = false) {
  const a = {};
  arr?.lines?.forEach((item) => {
    let name = item.name;
    name += ` L${item.levelRequired}`;
    name += ` ${item.variant}`;
    a[name] = item.chaosValue;
  });
  return a;
}

function cleanCurrencyData(arr, getLowConfidence = false) {
  if (!arr?.lines || !arr?.items) {
    logger.error('Unexpected data format from poe.ninja for exchange overview category');
    logger.error('Data received: ' + JSON.stringify(arr));
    return {};
  }
  const a = {};
  arr?.lines?.forEach((item) => {
    item.name = arr.items.find((i) => i.id === item.id)?.name || item.name;
    if (item.count && item.count < 10 && !getLowConfidence) return; // ignore low confidence listings
    a[item.name] = item.primaryValue;
  });
  return a;
}

function cleanWombgift(arr, getLowConfidence = false) {
  const a = {};
  arr?.lines?.forEach((item) => {
    const name = `${item.name} L${item.levelRequired}`;
    a[name] = item.chaosValue;
  });
  return a;
}

function cleanItemData(arr, getLowConfidence = false) {
  const a = {};
  arr?.lines?.forEach((item) => {
    let name = item.name;
    // Handle 6L items
    if (item.links === 6) {
      name += ' 6L';
    }

    // Handle Gem Variants
    else if (item.gemLevel) {
      name += ` L${item.gemLevel}`;
      if (item.gemQuality) {
        name += ` Q${item.gemQuality}`;
      }
    }

    // Handle Cluster Jewels
    else if (item.baseType.includes('Cluster Jewel') && item.variant) {
      name += ` L${item.levelRequired}`;
      name += ` ${item.variant.split(' ')[0]}P`; // Number of passives
    }

    // TODO: Handle Foulborn variants
    // const name = `${item.name} L${item.levelRequired}`;
    a[name] = item.chaosValue;
  });
  return a;
}

function cleanUniqueMaps(arr, getLowConfidence = false) {
  const a = {};
  arr?.lines?.forEach((item) => {
    let name = item.name;
    a[name] = item.chaosValue;
  });
  return a;
}

function cleanMaps(arr, getLowConfidence = false) {
  const a = {};
  arr?.lines?.forEach((item) => {
    let name = item.name;
    if (item.variant) name += ` ${item.variant.replace(', ', '')}`;
    a[name] = item.chaosValue;
  });
  return a;
}

const getter = new RateGetterV2();

export default getter;
