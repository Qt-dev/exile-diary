import Axios from 'axios';
import { buildMemoryStorage, setupCache } from 'axios-cache-interceptor/dev';
import Bottleneck from 'bottleneck';
import Logger from 'electron-log';
import dayjs from 'dayjs';
import packageJson from '../../../../package.json';
import {
  buildPoeNinjaPath,
  EXCHANGE_CATEGORIES,
  STASH_CATEGORIES,
  type PoeNinjaCategory,
} from './categoryCatalog';

const logger = Logger.scope('pricing/poe-ninja');
const CACHE_TTL_MS = 5 * 60 * 1000;
const TREND_CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 3;

const axios = setupCache(
  Axios.create({
    baseURL: 'https://poe.ninja',
    headers: {
      'User-Agent': `Exile-Diary-Reborn/${packageJson.version} (poe.ninja pricing; +https://github.com/qt-dev/exile-diary)`,
    },
  }),
  {
    enabled: true,
    ttl: CACHE_TTL_MS,
    storage: buildMemoryStorage(),
    interpretHeader: true,
    vary: false,
  }
);

const limiter = new Bottleneck({ maxConcurrent: 2, minTime: 350 });

export type SparklinePoint = {
  time: string;
  price: number;
};

type ItemMeta = {
  category: PoeNinjaCategory;
  isExchange: boolean;
  id: string | number;
  detailsId?: string;
};

export class PoeNinjaClient {
  private trendCache = new Map<string, { timestamp: number; data: SparklinePoint[] }>();
  private itemMetaIndex = new Map<string, ItemMeta>();

  async getCategory(
    category: PoeNinjaCategory,
    league: string,
    options: { useGzip?: boolean; useCache?: boolean } = {}
  ): Promise<any> {
    const path = buildPoeNinjaPath(category, league);
    return limiter.schedule({ id: path.replace(/[^a-zA-Z0-9]/g, '-') }, async () => {
      let lastError: unknown;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
          logger.info(`Requesting poe.ninja category ${category} for ${league}`);
          const response: any = await axios({
            url: path,
            method: 'GET',
            timeout: options.useGzip === false ? 30000 : 10000,
            headers: { 'Accept-Encoding': options.useGzip === false ? 'identity' : 'gzip' },
            cache: options.useCache === false ? false : { enabled: true, ttl: CACHE_TTL_MS },
          });

          const data = response.data;
          this.indexCategoryItems(category, league, data);
          return data;
        } catch (error) {
          lastError = error;
          if (attempt < MAX_ATTEMPTS) {
            await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
          }
        }
      }
      throw lastError;
    });
  }

  private indexCategoryItems(category: PoeNinjaCategory, league: string, data: any) {
    if (!data || typeof data !== 'object') return;

    const isExchange = (EXCHANGE_CATEGORIES as readonly string[]).includes(category);
    if (isExchange && Array.isArray(data.items)) {
      for (const item of data.items) {
        if (item.name) {
          const key = `${league}:${item.name.toLowerCase()}`;
          this.itemMetaIndex.set(key, {
            category,
            isExchange: true,
            id: item.id,
            detailsId: item.detailsId || item.id,
          });
        }
      }
    } else if (!isExchange && Array.isArray(data.lines)) {
      for (const line of data.lines) {
        if (line.name) {
          const key = `${league}:${line.name.toLowerCase()}`;
          // Retain first/highest priority mapping
          if (!this.itemMetaIndex.has(key)) {
            this.itemMetaIndex.set(key, {
              category,
              isExchange: false,
              id: line.id,
              detailsId: line.detailsId,
            });
          }
        }
      }
    }
  }

  /**
   * Fetches on-demand 7-day+ real market trend from poe.ninja.
   * Stored ONLY in memory (never written to SQLite DB).
   */
  async getItemMarketTrend(
    itemIdentifier: string,
    league: string
  ): Promise<SparklinePoint[]> {
    const cacheKey = `${league}:${itemIdentifier}`;
    const cached = this.trendCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < TREND_CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const metaKey = `${league}:${itemIdentifier.toLowerCase()}`;
      let meta = this.itemMetaIndex.get(metaKey);

      // If item metadata isn't indexed yet, scan common categories
      if (!meta) {
        meta = await this.locateItemMeta(itemIdentifier, league);
      }

      if (meta) {
        let points: SparklinePoint[] = [];

        if (meta.isExchange) {
          points = await this.fetchExchangeDetails(meta.category, meta.detailsId || String(meta.id), league);
        } else {
          points = await this.fetchStashHistory(meta.category, meta.id, league);
        }

        if (points.length > 0) {
          this.trendCache.set(cacheKey, { timestamp: now, data: points });
          return points;
        }
      }
    } catch (err) {
      logger.warn(`Failed to fetch poe.ninja market trend for ${itemIdentifier} in ${league}:`, err);
    }

    // Graceful fallback if item has no historical trend or endpoint unavailable
    const fallback: SparklinePoint[] = [
      {
        time: new Date().toISOString(),
        price: 0,
      },
    ];
    return fallback;
  }

  private async locateItemMeta(itemIdentifier: string, league: string): Promise<ItemMeta | undefined> {
    const query = itemIdentifier.toLowerCase();

    // 1. Search exchange categories first
    for (const cat of EXCHANGE_CATEGORIES) {
      try {
        const data = await this.getCategory(cat, league);
        if (data && Array.isArray(data.items)) {
          const item = data.items.find((i: any) => i.name && i.name.toLowerCase() === query);
          if (item) {
            return {
              category: cat,
              isExchange: true,
              id: item.id,
              detailsId: item.detailsId || item.id,
            };
          }
        }
      } catch {
        // continue
      }
    }

    // 2. Search stash categories
    for (const cat of STASH_CATEGORIES) {
      try {
        const data = await this.getCategory(cat, league);
        if (data && Array.isArray(data.lines)) {
          const line = data.lines.find((l: any) => l.name && l.name.toLowerCase() === query);
          if (line) {
            return {
              category: cat,
              isExchange: false,
              id: line.id,
              detailsId: line.detailsId,
            };
          }
        }
      } catch {
        // continue
      }
    }

    return undefined;
  }

  private async fetchExchangeDetails(
    category: PoeNinjaCategory,
    detailsId: string,
    league: string
  ): Promise<SparklinePoint[]> {
    const path = `/poe1/api/economy/exchange/current/details?league=${encodeURIComponent(league)}&type=${encodeURIComponent(category)}&id=${encodeURIComponent(detailsId)}`;
    return limiter.schedule({ id: `details-${path}` }, async () => {
      try {
        const response: any = await axios({
          url: path,
          method: 'GET',
          timeout: 10000,
          cache: { enabled: true, ttl: CACHE_TTL_MS },
        });

        const pairs = response.data?.pairs || [];
        const primaryPair = pairs.find((p: any) => p.id === 'chaos') || pairs[0];
        const rawHistory = primaryPair?.history || [];

        const points: SparklinePoint[] = rawHistory.map((h: any) => ({
          time: h.timestamp,
          price: Number(h.rate),
        }));

        points.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        return points;
      } catch (err) {
        logger.debug(`Error fetching exchange details for ${detailsId}:`, err);
        return [];
      }
    });
  }

  private async fetchStashHistory(
    category: PoeNinjaCategory,
    id: string | number,
    league: string
  ): Promise<SparklinePoint[]> {
    const path = `/poe1/api/economy/stash/current/item/history?league=${encodeURIComponent(league)}&type=${encodeURIComponent(category)}&id=${encodeURIComponent(id)}`;
    return limiter.schedule({ id: `history-${path}` }, async () => {
      try {
        const response: any = await axios({
          url: path,
          method: 'GET',
          timeout: 10000,
          cache: { enabled: true, ttl: CACHE_TTL_MS },
        });

        const rawList = Array.isArray(response.data) ? response.data : [];
        const points: SparklinePoint[] = rawList.map((h: any) => ({
          time: dayjs().subtract(h.daysAgo, 'day').startOf('day').toISOString(),
          price: Number(h.value),
        }));

        points.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        return points;
      } catch (err) {
        logger.debug(`Error fetching stash history for ${id}:`, err);
        return [];
      }
    });
  }
}

export default new PoeNinjaClient();
