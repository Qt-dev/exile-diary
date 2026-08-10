import * as path from 'path';
import * as fs from 'fs/promises';
import Logger from 'electron-log';
import dayjs from 'dayjs';
import { getUserDataPath } from '../../runtime/getUserDataPath';
import PoeNinjaClient, { type SparklinePoint } from '../poe-ninja/PoeNinjaClient';
import {
  EXCHANGE_CATEGORIES,
  STASH_CATEGORIES,
  type PoeNinjaCategory,
} from '../poe-ninja/categoryCatalog';

const logger = Logger.scope('pricing/PricingHistoryStore');

export type HistoryPoint = {
  time: string;
  price: number;
};

export type ItemHistoryRecord = {
  category: string;
  isExchange: boolean;
  id: string | number;
  detailsId?: string;
  lastUpdated: string;
  history: HistoryPoint[];
};

export type LeagueHistoryMap = {
  lastSync?: string;
  items: Record<string, ItemHistoryRecord>;
};

export type PricingHistorySchema = {
  version: number;
  leagues: Record<string, LeagueHistoryMap>;
};

let tempFileCounter = 0;

export class PricingHistoryStore {
  private data: PricingHistorySchema = {
    version: 1,
    leagues: {},
  };
  private isLoaded = false;
  private saveScheduler: NodeJS.Timeout | null = null;
  private syncInProgress = new Map<string, Promise<void>>();

  private getHistoryPath(): string {
    return path.join(getUserDataPath(), 'pricing_history.json');
  }

  private getTempPath(): string {
    tempFileCounter += 1;
    return path.join(
      getUserDataPath(),
      `pricing_history.${process.pid}.${tempFileCounter}.json.tmp`
    );
  }

  /**
   * Loads pricing history cache file from userData data folder.
   */
  async load(): Promise<void> {
    if (this.isLoaded) return;
    const historyPath = this.getHistoryPath();

    try {
      const content = await fs.readFile(historyPath, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object' && parsed.version) {
        this.data = parsed;
        logger.info(`Loaded pricing history cache from ${historyPath}`);
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        logger.warn(`Could not read pricing history cache from ${historyPath}:`, err);
      }
      this.data = { version: 1, leagues: {} };
    } finally {
      this.isLoaded = true;
    }
  }

  /**
   * Schedules debounced atomic write of pricing_history.json
   */
  scheduleSave(): void {
    if (this.saveScheduler) clearTimeout(this.saveScheduler);
    this.saveScheduler = setTimeout(() => {
      void this.save().catch((err) => {
        logger.error('Error saving pricing history cache:', err);
      });
    }, 500);
  }

  /**
   * Atomically writes pricing history to data folder.
   */
  async save(): Promise<void> {
    const targetPath = this.getHistoryPath();
    const tempPath = this.getTempPath();

    try {
      const json = JSON.stringify(this.data, null, 2);
      await fs.writeFile(tempPath, json, 'utf8');
      await fs.rename(tempPath, targetPath);
      logger.debug(`Saved pricing history cache to ${targetPath}`);
    } catch (err) {
      logger.error(`Failed to save pricing history cache to ${targetPath}:`, err);
    } finally {
      if (this.saveScheduler) clearTimeout(this.saveScheduler);
      this.saveScheduler = null;
    }
  }

  /**
   * Eagerly fetches pricing overview on launch, populating cache and computing deltas.
   */
  async eagerSync(league: string): Promise<void> {
    if (!league) return;
    await this.load();

    const existingPromise = this.syncInProgress.get(league);
    if (existingPromise) return existingPromise;

    const syncPromise = (async () => {
      try {
        logger.info(`Eagerly syncing pricing data for ${league}`);
        let leagueRecord = this.data.leagues[league];
        if (!leagueRecord) {
          leagueRecord = { items: {} };
          this.data.leagues[league] = leagueRecord;
        }

        const now = dayjs();
        const todayIso = now.startOf('day').toISOString();

        // 1. Sync Exchange Categories
        for (const cat of EXCHANGE_CATEGORIES) {
          try {
            const data = await PoeNinjaClient.getCategory(cat, league);
            if (data && Array.isArray(data.items) && Array.isArray(data.lines)) {
              const linesMap = new Map((data.lines || []).map((l: any) => [l.id || l.name, l]));
              for (const item of data.items) {
                if (!item.name) continue;
                const key = item.name.toLowerCase();
                const line: any = linesMap.get(item.id) || linesMap.get(item.name);
                const currentPrice = (line?.primaryValue ?? line?.chaosValue) || 0;

                let existing = leagueRecord.items[key];
                if (!existing) {
                  existing = {
                    category: cat,
                    isExchange: true,
                    id: item.id,
                    detailsId: item.detailsId || item.id,
                    lastUpdated: now.toISOString(),
                    history: [
                      {
                        time: todayIso,
                        price: currentPrice,
                      },
                    ],
                  };
                  leagueRecord.items[key] = existing;
                } else {
                  // Merge today's delta
                  this.mergeSinglePoint(existing.history, {
                    time: todayIso,
                    price: currentPrice,
                  });
                  existing.lastUpdated = now.toISOString();
                }
              }
            }
          } catch (err) {
            logger.debug(`Eager sync skipped category ${cat} for ${league}:`, err);
          }
        }

        // 2. Sync Stash Categories
        for (const cat of STASH_CATEGORIES) {
          try {
            const data = await PoeNinjaClient.getCategory(cat, league);
            if (data && Array.isArray(data.lines)) {
              for (const line of data.lines) {
                if (!line.name) continue;
                const key = line.name.toLowerCase();
                const currentPrice = line.chaosValue || 0;

                let existing = leagueRecord.items[key];
                if (!existing) {
                  existing = {
                    category: cat,
                    isExchange: false,
                    id: line.id,
                    detailsId: line.detailsId,
                    lastUpdated: now.toISOString(),
                    history: [
                      {
                        time: todayIso,
                        price: currentPrice,
                      },
                    ],
                  };
                  leagueRecord.items[key] = existing;
                } else {
                  this.mergeSinglePoint(existing.history, {
                    time: todayIso,
                    price: currentPrice,
                  });
                  existing.lastUpdated = now.toISOString();
                }
              }
            }
          } catch (err) {
            logger.debug(`Eager sync skipped stash category ${cat} for ${league}:`, err);
          }
        }

        leagueRecord.lastSync = now.toISOString();
        this.scheduleSave();
        logger.info(`Completed eager sync for ${league} (${Object.keys(leagueRecord.items).length} items cached)`);
      } catch (err) {
        logger.error(`Error during eager pricing sync for ${league}:`, err);
      } finally {
        this.syncInProgress.delete(league);
      }
    })();

    this.syncInProgress.set(league, syncPromise);
    return syncPromise;
  }

  /**
   * Retrieves 7-day+ market history for an item.
   * Serves the on-disk cache immediately (even if stale) and refreshes it
   * from poe.ninja in the background so callers never block on the network.
   * Only blocks on a live fetch when there is no cache at all for this item.
   */
  async getItemHistory(
    itemIdentifier: string,
    league: string
  ): Promise<SparklinePoint[]> {
    await this.load();
    const key = itemIdentifier.toLowerCase();
    let leagueRecord = this.data.leagues[league];
    if (!leagueRecord) {
      leagueRecord = { items: {} };
      this.data.leagues[league] = leagueRecord;
    }

    const cachedItem = leagueRecord.items[key];
    const now = dayjs();

    // eagerSync only ever seeds a single point per day (today's price), so a
    // cache with just one point is not yet a real multi-day trend. Treat it
    // like "no cache" and block on a live fetch instead of serving a flat
    // single-point chart while a background refresh silently updates disk.
    if (cachedItem && cachedItem.history.length > 1) {
      // Serve cache immediately; refresh in the background if it's stale.
      if (now.diff(dayjs(cachedItem.lastUpdated), 'hour') >= 4) {
        void this.refreshItemHistory(itemIdentifier, league);
      }
      return cachedItem.history;
    }

    // No real cache yet: block on a live fetch so the first view isn't empty.
    const freshPoints = await this.refreshItemHistory(itemIdentifier, league);
    if (freshPoints && freshPoints.length > 0) {
      return freshPoints;
    }

    return [
      {
        time: now.toISOString(),
        price: 0,
      },
    ];
  }

  /**
   * Forces a blocking live fetch of full market history, bypassing the cache
   * entirely. Used when the cache only holds eagerSync's single daily point
   * and the caller needs the real multi-day trend right away.
   */
  async forceRefreshItemHistory(
    itemIdentifier: string,
    league: string
  ): Promise<SparklinePoint[]> {
    await this.load();
    const freshPoints = await this.refreshItemHistory(itemIdentifier, league);
    if (freshPoints && freshPoints.length > 0) {
      return freshPoints;
    }
    return [
      {
        time: dayjs().toISOString(),
        price: 0,
      },
    ];
  }

  /**
   * Fetches fresh history/delta from poe.ninja and merges it into the cache.
   * Safe to call in the background without awaiting.
   */
  private async refreshItemHistory(
    itemIdentifier: string,
    league: string
  ): Promise<SparklinePoint[] | null> {
    const key = itemIdentifier.toLowerCase();
    let leagueRecord = this.data.leagues[league];
    if (!leagueRecord) {
      leagueRecord = { items: {} };
      this.data.leagues[league] = leagueRecord;
    }

    try {
      const freshPoints = await PoeNinjaClient.getItemMarketTrend(itemIdentifier, league);
      if (freshPoints && freshPoints.length > 0 && freshPoints[0].price > 0) {
        const now = dayjs();
        const cachedItem = leagueRecord.items[key];
        if (!cachedItem) {
          leagueRecord.items[key] = {
            category: 'General',
            isExchange: true,
            id: key,
            lastUpdated: now.toISOString(),
            history: freshPoints,
          };
        } else {
          cachedItem.history = this.mergeHistoryPoints(cachedItem.history, freshPoints);
          cachedItem.lastUpdated = now.toISOString();
        }
        this.scheduleSave();
        return leagueRecord.items[key].history;
      }
    } catch (err) {
      logger.warn(`Error updating missing delta for ${itemIdentifier}:`, err);
    }

    return null;
  }

  private mergeSinglePoint(history: HistoryPoint[], newPoint: HistoryPoint): void {
    const newDay = dayjs(newPoint.time).format('YYYY-MM-DD');
    const existingIndex = history.findIndex(
      (h) => dayjs(h.time).format('YYYY-MM-DD') === newDay
    );

    if (existingIndex >= 0) {
      history[existingIndex] = newPoint;
    } else {
      history.push(newPoint);
      history.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    }
  }

  private mergeHistoryPoints(
    existingHistory: HistoryPoint[],
    newPoints: HistoryPoint[]
  ): HistoryPoint[] {
    const map = new Map<string, HistoryPoint>();

    for (const pt of existingHistory) {
      const dayKey = dayjs(pt.time).format('YYYY-MM-DD');
      map.set(dayKey, pt);
    }

    for (const pt of newPoints) {
      const dayKey = dayjs(pt.time).format('YYYY-MM-DD');
      map.set(dayKey, pt);
    }

    const merged = Array.from(map.values());
    merged.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    return merged;
  }
}

export const pricingHistoryStore = new PricingHistoryStore();
export default pricingHistoryStore;
