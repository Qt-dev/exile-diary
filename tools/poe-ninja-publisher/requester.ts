import { buildPoeNinjaPath, type PoeNinjaCategory } from '../../src/shared/pricing/catalog';

export type PublisherRequest = { status: number; headers: Headers; json(): Promise<unknown> };
export type PublisherFetch = (input: string, init?: RequestInit) => Promise<PublisherRequest>;
export type CategoryFetchResult = { body?: unknown; etag?: string; unchanged: boolean };
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class PoeNinjaRequester {
  private nextStart = 0;
  private active = 0;
  private readonly queued: Array<() => void> = [];
  constructor(private readonly fetcher: PublisherFetch = fetch as unknown as PublisherFetch, private readonly options: { baseUrl?: string; userAgent?: string; minTimeMs?: number; maxConcurrent?: number; maxAttempts?: number } = {}) {}
  private async scheduled<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= (this.options.maxConcurrent ?? 2)) await new Promise<void>((resolve) => this.queued.push(resolve));
    this.active += 1;
    const wait = Math.max(0, this.nextStart - Date.now()); this.nextStart = Math.max(this.nextStart, Date.now()) + (this.options.minTimeMs ?? 350);
    try { if (wait) await delay(wait); return await operation(); } finally { this.active -= 1; this.queued.shift()?.(); }
  }
  async getCategory(category: PoeNinjaCategory, league: string, etag?: string): Promise<CategoryFetchResult> {
    return this.scheduled(async () => {
      let failure: unknown;
      for (let attempt = 0; attempt < (this.options.maxAttempts ?? 3); attempt += 1) {
        try {
          const response = await this.fetcher(`${this.options.baseUrl ?? 'https://poe.ninja'}${buildPoeNinjaPath(category, league)}`, { headers: { 'User-Agent': this.options.userAgent ?? 'Exile-Diary-Reborn/pricing-publisher (+https://github.com/qt-dev/exile-diary)', Accept: 'application/json', ...(etag ? { 'If-None-Match': etag } : {}) } });
          if (response.status === 304) return { unchanged: true, etag };
          if (response.status >= 200 && response.status < 300) return { unchanged: false, etag: response.headers.get('etag') ?? undefined, body: await response.json() };
          if (response.status < 500 && response.status !== 429) throw new Error(`poe.ninja returned HTTP ${response.status}`);
          const retryAfter = Number(response.headers.get('retry-after')); throw Object.assign(new Error(`poe.ninja returned HTTP ${response.status}`), { retryAfterMs: Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined });
        } catch (error: any) { failure = error; if (attempt + 1 >= (this.options.maxAttempts ?? 3)) break; const retryAfter = typeof error?.retryAfterMs === 'number' ? error.retryAfterMs : undefined; await delay(retryAfter ?? 250 * 2 ** attempt + Math.floor(Math.random() * 100)); }
      }
      throw failure;
    });
  }
  async getLeagues(): Promise<string[]> {
    const result = await this.scheduled(async () => {
      const response = await this.fetcher(`${this.options.baseUrl ?? 'https://poe.ninja'}/poe1/api/economy/leagues`, { headers: { 'User-Agent': this.options.userAgent ?? 'Exile-Diary-Reborn/pricing-publisher (+https://github.com/qt-dev/exile-diary)', Accept: 'application/json' } });
      if (response.status < 200 || response.status >= 300) throw new Error(`poe.ninja league query returned HTTP ${response.status}`);
      return response.json();
    });
    const values = Array.isArray(result) ? result : (result as any)?.leagues;
    if (!Array.isArray(values)) throw new Error('poe.ninja league response was not an array');
    return values
      .map((item: any) => (typeof item === 'string' ? item : item?.id))
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
  }
}
