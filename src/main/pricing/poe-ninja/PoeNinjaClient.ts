import Axios from 'axios';
import { buildMemoryStorage, setupCache } from 'axios-cache-interceptor/dev';
import Bottleneck from 'bottleneck';
import Logger from 'electron-log';
import packageJson from '../../../../package.json';
import { buildPoeNinjaPath, type PoeNinjaCategory } from './categoryCatalog';

const logger = Logger.scope('pricing/poe-ninja');
const CACHE_TTL_MS = 5 * 60 * 1000;
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

export class PoeNinjaClient {
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
          return response.data;
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
}

export default new PoeNinjaClient();
