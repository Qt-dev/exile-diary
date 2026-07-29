import RendererLogger from '../RendererLogger';
import SettingsManager from '../SettingsManager';
import Logger from 'electron-log';
import DB from '../db/rates';
import PoeNinjaClient from './poe-ninja/PoeNinjaClient';
import {
  POE_NINJA_CATEGORIES,
  buildPoeNinjaPath,
  type PoeNinjaCategory,
} from './poe-ninja/categoryCatalog';
import {
  adaptPoeNinjaResponse,
  assembleLegacySnapshot,
} from './poe-ninja/responseAdapters';
import { normalizePoeNinjaLeagueName } from './poe-ninja/leagueResolver';
import { CURRENT_PRICE_SNAPSHOT_SCHEMA, type PriceSnapshot } from './types';

const EventEmitter = require('events');
const dayjs = require('dayjs');
const logger = Logger.scope('PricingService');

export function normalizeNinjaLeagueName(league: string) {
  return normalizePoeNinjaLeagueName(league);
}

var nextRateGetTimer;
var emitter = new EventEmitter();

class PricingService {
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
    this.postUpdateCallback = postUpdateCallback;
    void this.update();
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
    const { useGzip = true } = SettingsManager.getAll();

    try {
      for (const [rateType, definition] of Object.entries(POE_NINJA_CATEGORIES)) {
        let data;
        logger.info(`Getting prices for item type ${rateType}`);
        try {
          data = await PoeNinjaClient.getCategory(
            rateType as PoeNinjaCategory,
            this.getNinjaLeagueName(),
            { useGzip, useCache }
          );
          tempRates[rateType] = adaptPoeNinjaResponse(definition, data);
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

    const rates = assembleLegacySnapshot(tempRates, POE_NINJA_CATEGORIES);

    const snapshot: PriceSnapshot = {
      schemaVersion: CURRENT_PRICE_SNAPSHOT_SCHEMA,
      provider: 'poe.ninja',
      leagueId: this.getLeagueName(false),
      fetchedAt: new Date().toISOString(),
      categories: rates,
    };
    const ratesWereUpdated = await DB.insertRates(this.getLeagueName(false), date, snapshot);
    if (!ratesWereUpdated) {
      emitter.emit('gettingPricesFailed');
      return;
    } else {
      emitter.emit('doneGettingPrices');
      this.ratesReady = true;
      this.scheduleNextUpdate();
    }
  }

  getNinjaURL(category: PoeNinjaCategory) {
    return buildPoeNinjaPath(category, this.getNinjaLeagueName());
  }

  hasExistingRates(date) {
    return DB.hasExistingRates(this.getLeagueName(), date);
  }
}

const getter = new PricingService();

export default getter;
