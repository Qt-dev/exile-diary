import RendererLogger from '../RendererLogger';
import SettingsManager from '../SettingsManager';
import Logger from 'electron-log';
import Utils from './Utils';
import DB from '../db/rates';

const EventEmitter = require('events');
const dayjs = require('dayjs');
const https = require('https');
const zlib = require('zlib');
const logger = Logger.scope('RateGetter');

const rateTypes = {
  Currency: cleanCurrency,
  Fragment: cleanCurrency,

  Tattoo: cleanNameValuePairs,
  Omen: cleanNameValuePairs,
  DivinationCard: cleanNameValuePairs,
  Artifact: cleanNameValuePairs,
  Oil: cleanNameValuePairs,
  Incubator: cleanNameValuePairs,

  UniqueWeapon: cleanUniqueItems,
  UniqueArmour: cleanUniqueItems,
  UniqueAccessory: cleanUniqueItems,
  UniqueJewel: cleanUniqueItems,
  UniqueFlask: cleanUniqueItems,
  SkillGem: cleanGems,

  Map: cleanMaps,
  BlightedMap: cleanMaps,
  BlightRavagedMap: cleanMaps,
  // ScourgedMap: cleanMaps, // No Scourged map around nowadays
  UniqueMap: cleanUniqueMaps,
  DeliriumOrb: cleanNameValuePairs,
  Invitation: cleanNameValuePairs,
  Scarab: cleanNameValuePairs,
  Memory: cleanNameValuePairs,

  BaseType: cleanBaseTypes,
  Fossil: cleanNameValuePairs,
  Resonator: cleanNameValuePairs,
  // HelmetEnchant: cleanEnchants,
  Beast: cleanNameValuePairs,
  Essence: cleanNameValuePairs,
  Vial: cleanNameValuePairs,
  KalguuranRune: cleanNameValuePairs,
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

    if(useOverride && activeProfile.leagueOverride && activeProfile.leagueOverride.length > 0) {
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
      await this.getRates(today);
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

  async getRates(date) {
    const tempRates = {};
    const { useGzip = true, getLowConfidence = false } = SettingsManager.getAll();

    try {
      for (const rateType in rateTypes) {
        let data;
        for (let i = 1; i <= 10; i++) {
          logger.info(`Getting prices for item type ${rateType}, attempt ${i} of 10`);
          try {
            data = await getNinjaData(this.getNinjaURL(rateType), useGzip);
            break;
          } catch (err) {
            if (i === 10) {
              logger.error(`Error in getting POE data for ${rateType}`);
              logger.error(err);
            }
          }
        }
        const processRateType = rateTypes[rateType];
        tempRates[rateType] = processRateType(data, getLowConfidence);
      }
      // require('fs/promises').writeFile('./rates.json', JSON.stringify(tempRates, null, 2), 'utf8');
      logger.info('Finished getting prices from poe.ninja, processing now');
    } catch (e) {
      emitter.emit('gettingPricesFailed');
      logger.info('Error getting rates: ' + e);
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
    rates['KalguuranRune'] = tempRates['KalguuranRune'];

    // Necropolis
    // rates['Coffin'] = tempRates['Coffin'];
    // rates['AllflameEmber'] = tempRates['AllflameEmber'];

    // Retired data
    // rates['Watchstone'] = tempRates['Watchstone'];
    // rates['Seed'] = tempRates['Seed'];
    // rates['Prophecy'] = tempRates['Prophecy'];

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
        url = `/api/data/currencyoverview?type=${category}`;
        break;
      case 'Omen':
      case 'DivinationCard':
      case 'Artifact':
      case 'Oil':
      case 'Incubator':

      case 'UniqueWeapon':
      case 'UniqueArmour':
      case 'UniqueAccessory':
      case 'UniqueJewel':
      case 'UniqueFlask':
      case 'UniqueRelic':
      case 'SkillGem':
      case 'ClusterJewel':

      case 'Map':
      case 'BlightedMap': // TODO: Add pricing
      case 'BlightRavagedMap': // TODO: Add pricing
      case 'ScourgedMap': // TODO: Add pricing
      case 'UniqueMap':
      case 'DeliriumOrb':
      case 'Invitation':
      case 'Scarab':
      case 'Memory': // TODO: Fix pricing
      case 'KalguuranRune':

      case 'BaseType':
      case 'Fossil':
      case 'Resonator':
      case 'Beast':
      case 'Essence':
      case 'Vial':
      case 'Tattoo':
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

    return `${url}&league=${encodeURIComponent(this.getLeagueName())}`;
  }

  hasExistingRates(date) {
    return DB.hasExistingRates(this.getLeagueName(), date);
  }
}

function getNinjaData(path, useGzip) {
  return new Promise((resolve, reject) => {
    const headerObject = useGzip ? { 'Accept-Encoding': 'gzip' } : {};
    const timeout = useGzip ? 10000 : 30000;

    const request = https.request(
      {
        hostname: 'poe.ninja',
        path: path,
        method: 'GET',
        headers: headerObject,
      },
      (response) => {
        var buffers: any = [];
        response.on('data', (chunk) => {
          buffers.push(chunk);
        });
        response.on('end', () => {
          try {
            var data;
            var body = Buffer.concat(buffers);
            try {
              data = useGzip ? zlib.gunzipSync(body) : body.toString();
            } catch (e) {
              logger.info('Error unzipping received data: ' + e);
            }
            logger.info(
              `Got data from ${path}, length ${body.length} ${
                useGzip ? `(${data.length} uncompressed)` : ''
              }`
            );
            resolve(JSON.parse(data));
          } catch (e) {
            logger.info(`Failed to get data from [${path}]: ${e}`);
            reject(e);
          }
        });
        response.on('error', (e) => {
          logger.info(`Failed to get data from [${path}]: ${e}`);
          reject(e);
        });
        response.on('aborted', (e) => {
          logger.info(`Failed to get data from [${path}]: response aborted!`);
          reject(e);
        });
      }
    );
    request.on('error', (e) => {
      logger.info(`Failed to get data from [${path}]: ${e}`);
      reject(e);
    });
    request.on('timeout', () => {
      request.destroy(new Error(`Timed out after ${timeout / 1000} seconds`));
    });
    request.setTimeout(timeout);
    request.end();
  });
}

function cleanBaseTypes(arr, getLowConfidence = false) {
  const a = {};
  arr?.lines?.forEach((item) => {
    if (item.count && item.count < 10 && !getLowConfidence) return; // ignore low confidence listings
    var identifier = item.name;
    if (item.levelRequired) identifier += ` L${item.levelRequired}`;
    if (item.variant) identifier += ` ${item.variant}`;
    a[identifier] = item.chaosValue;
  });
  return a;
}

function cleanUniqueItems(arr, getLowConfidence = false) {
  const a = {};
  arr?.lines?.forEach((item) => {
    if (item.count && item.count < 10 && !getLowConfidence) return; // ignore low confidence listings
    var identifier = item.name;
    if (item.name === 'Grand Spectrum' || item.name === 'Combat Focus')
      identifier += ` ${item.baseType}`;
    if (item.links) identifier += ` ${item.links}L`;
    if (item.variant) identifier += ` (${item.variant})`;
    if (item.itemClass === 9) identifier += ` (Relic)`;
    a[identifier] = item.chaosValue;
  });
  return a;
}

function cleanByModAndLevel(arr, getLowConfidence = false) {
  const a = {};
  arr?.lines?.forEach((item) => {
    const { name, chaosValue } = item;
    const { ilvl } = item.tradeFilter.query.filters.misc_filters.filters;
    a[`${name} L${ilvl.min}-${ilvl.max}`] = chaosValue;
  });

  return a;
}

function cleanGems(arr, getLowConfidence = false) {
  const a = {};
  arr?.lines?.forEach((item) => {
    if (item.count && item.count < 10 && !getLowConfidence) return; // ignore low confidence listings
    var identifier = item.name;
    if (item.gemLevel !== 1) identifier += ` L${item.gemLevel}`;
    if (item.gemQuality >= 20) {
      if (!specialGems.includes(item.name)) {
        identifier += ` Q${item.gemQuality}`;
      }
    }
    if (item.corrupted) {
      identifier += ' (Corrupted)';
    }
    a[identifier] = item.chaosValue;
  });
  return a;
}

function cleanCurrency(arr, getLowConfidence = false) {
  const a = {};
  arr?.lines?.forEach((item) => {
    if (item.currencyTypeName === "Rogue's Marker") {
      return;
    }
    if (item.count && item.count < 10 && !getLowConfidence) return; // ignore low confidence listings
    a[item.currencyTypeName] = item.chaosEquivalent;
  });
  return a;
}

function cleanNameValuePairs(arr, getLowConfidence = false) {
  const a = {};
  arr?.lines?.forEach((item) => {
    if (item.count && item.count < 10 && !getLowConfidence) return; // ignore low confidence listings
    a[item.name] = item.chaosValue;
  });
  return a;
}

function cleanEnchants(arr, getLowConfidence = false) {
  const a = {};
  arr?.lines?.forEach((item) => {
    if (item.count && item.count < 10 && !getLowConfidence) return; // ignore low confidence listings
    if (item.icon) {
      a[item.name] = item.chaosValue;
    }
  });
  return a;
}

function cleanUniqueMaps(arr, getLowConfidence = false) {
  const a = {};
  arr?.lines?.forEach((item) => {
    if (item.count && item.count < 10 && !getLowConfidence) return; // ignore low confidence listings
    var identifier = `${item.name} T${item.mapTier} ${item.baseType}`;
    a[identifier] = item.chaosValue;
  });
  return a;
}

function cleanMaps(arr, getLowConfidence = false) {
  const a = {};
  arr?.lines?.forEach((item) => {
    if (item.count && item.count < 10 && !getLowConfidence) return; // ignore low confidence listings
    var identifier = `${item.baseType} T${item.mapTier} ${item.variant}`;
    a[identifier] = item.chaosValue;
  });
  return a;
}

function cleanWatchstones(arr, getLowConfidence = false) {
  const a = {};
  arr?.lines?.forEach((item) => {
    if (item.count && item.count < 10 && !getLowConfidence) return; // ignore low confidence listings
    var identifier = `${item.name}, ${item.variant} uses remaining`;
    a[identifier] = item.chaosValue;
  });
  return a;
}

function cleanSeeds(arr, getLowConfidence = false) {
  const a = {};
  arr?.lines?.forEach((item) => {
    if (item.count && item.count < 10 && !getLowConfidence) return; // ignore low confidence listings
    var identifier = item.name;
    if (item.levelRequired >= 76) identifier += ` L76+`;
    a[identifier] = item.chaosValue;
  });
  return a;
}

const getter = new RateGetterV2();

export default getter;
