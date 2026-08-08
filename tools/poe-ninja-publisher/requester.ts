import { buildPoeNinjaPath, type PoeNinjaCategory } from '../../src/shared/pricing/catalog';
import packageJson from '../../package.json';

export type PublisherRequest = { status: number; headers: Headers; json(): Promise<unknown> };
export type PublisherFetch = (input: string, init?: RequestInit) => Promise<PublisherRequest>;
export type CategoryFetchResult = { body?: unknown; etag?: string; unchanged: boolean };
export type PoeNinjaRequesterOptions = {
  baseUrl?: string;
  userAgent?: string;
  contact?: string;
  minTimeMs?: number;
  maxConcurrent?: number;
  maxAttempts?: number;
};

const DEFAULT_CONTACT = 'https://github.com/qt-dev/exile-diary';
const RETRY_BASE_MS = 250;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
type RequestError = Error & { retryable?: boolean; retryAfterMs?: number };

function buildUserAgent(options: PoeNinjaRequesterOptions): string {
  if (options.userAgent) return options.userAgent;
  const contact = options.contact?.trim() || DEFAULT_CONTACT;
  if (/[\r\n]/.test(contact)) throw new Error('POE_NINJA_CONTACT must not contain line breaks');
  return `Exile-Diary-Reborn/${packageJson.version} (pricing-publisher; contact: ${contact})`;
}

function retryAfterMs(headers: Headers): number | undefined {
  const value = headers.get('retry-after');
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : undefined;
}

function errorForStatus(status: number, headers: Headers, label: string): RequestError {
  const retryable = status === 429 || status >= 500;
  return Object.assign(new Error(`${label} returned HTTP ${status}`), {
    retryable,
    retryAfterMs: retryable ? retryAfterMs(headers) : undefined,
  });
}

export class PoeNinjaRequester {
  private nextStart = 0;
  private active = 0;
  private readonly queued: Array<() => void> = [];
  private readonly userAgent: string;

  constructor(private readonly fetcher: PublisherFetch = fetch as unknown as PublisherFetch, private readonly options: PoeNinjaRequesterOptions = {}) {
    this.userAgent = buildUserAgent(options);
  }

  static fromEnvironment(fetcher?: PublisherFetch): PoeNinjaRequester {
    return new PoeNinjaRequester(fetcher, { contact: process.env.POE_NINJA_CONTACT });
  }

  private async scheduled<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= (this.options.maxConcurrent ?? 2)) await new Promise<void>((resolve) => this.queued.push(resolve));
    this.active += 1;
    const start = Math.max(Date.now(), this.nextStart);
    this.nextStart = start + (this.options.minTimeMs ?? 350);
    try {
      const wait = start - Date.now();
      if (wait > 0) await delay(wait);
      return await operation();
    } finally {
      this.active -= 1;
      this.queued.shift()?.();
    }
  }

  private async requestJson(path: string, etag?: string): Promise<{ body?: unknown; etag?: string; unchanged: boolean }> {
    let failure: unknown;
    const maxAttempts = this.options.maxAttempts ?? 3;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const baseUrl = (this.options.baseUrl ?? 'https://poe.ninja').replace(/\/+$/, '');
        const response = await this.scheduled(() => this.fetcher(`${baseUrl}${path}`, {
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'application/json',
            ...(etag ? { 'If-None-Match': etag } : {}),
          },
        }));
        if (response.status === 304) {
          if (!etag) throw new Error('poe.ninja returned HTTP 304 without a cached ETag');
          return { unchanged: true, etag };
        }
        if (response.status >= 200 && response.status < 300) {
          return { unchanged: false, etag: response.headers.get('etag') ?? undefined, body: await response.json() };
        }
        throw errorForStatus(response.status, response.headers, 'poe.ninja');
      } catch (error) {
        failure = error;
        const requestError = error as RequestError;
        if (requestError.retryable !== true && !(error instanceof TypeError)) throw error;
        if (attempt + 1 >= maxAttempts) break;
        await delay(requestError.retryAfterMs ?? RETRY_BASE_MS * 2 ** attempt + Math.floor(Math.random() * 100));
      }
    }
    throw failure;
  }

  async getCategory(category: PoeNinjaCategory, league: string, etag?: string): Promise<CategoryFetchResult> {
    return this.requestJson(buildPoeNinjaPath(category, league), etag);
  }

  async getLeagues(): Promise<string[]> {
    const result = await this.requestJson('/poe1/api/economy/leagues');
    const values = Array.isArray(result.body) ? result.body : (result.body as any)?.leagues;
    if (!Array.isArray(values)) throw new Error('poe.ninja league response was not an array');
    return values
      .map((item: any) => (typeof item === 'string' ? item : item?.id))
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
  }
}
