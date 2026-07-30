import crypto from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';
import {
  assertPriceSnapshot,
  assertPricingManifest,
  assertSnapshotHash,
  leagueKey as sharedLeagueKey,
  manifestPath,
  type PricingSnapshotManifest,
} from '../../../shared/pricing';
import { CURRENT_PRICE_SNAPSHOT_SCHEMA, type PriceIndex, type PriceSnapshot } from '../types';
import { DEFAULT_PRICING_PROXY_BASE_URL, type PricingTransport } from './PricingTransport';

const gunzip = promisify(zlib.gunzip);
const MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;

type FetchResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type FetchLike = (url: string, init?: Record<string, unknown>) => Promise<FetchResponse>;

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function validateIsoDate(value: unknown, label: string): string {
  const date = requireString(value, label);
  if (!Number.isFinite(Date.parse(date))) throw new Error(`${label} must be an ISO timestamp`);
  return date;
}

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

export function leagueKey(leagueId: string): string {
  return sharedLeagueKey(leagueId);
}

export function validateManifest(value: unknown, expectedLeagueId: string): PricingSnapshotManifest {
  assertPricingManifest(value, expectedLeagueId);
  const root = requireObject(value, 'manifest');
  if (root.protocolVersion !== 1) throw new Error('Unsupported pricing manifest protocol');
  if (root.leagueId !== expectedLeagueId) throw new Error('Pricing manifest league does not match request');
  validateIsoDate(root.publishedAt, 'manifest.publishedAt');
  const snapshot = requireObject(root.snapshot, 'manifest.snapshot');
  if (snapshot.schemaVersion !== CURRENT_PRICE_SNAPSHOT_SCHEMA) throw new Error('Unsupported price snapshot schema');
  const path = requireString(snapshot.path, 'manifest.snapshot.path');
  if (!path.startsWith('/v1/poe1/leagues/') || path.includes('..') || !path.endsWith('.json')) {
    throw new Error('Pricing snapshot path is invalid');
  }
  const sha256 = requireString(snapshot.sha256, 'manifest.snapshot.sha256');
  if (!/^[a-f0-9]{64}$/i.test(sha256)) throw new Error('Pricing snapshot checksum is invalid');
  const sizeBytes = snapshot.sizeBytes;
  if (typeof sizeBytes !== 'number' || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_SNAPSHOT_BYTES) {
    throw new Error('Pricing snapshot size is invalid');
  }
  return {
    protocolVersion: 1,
    leagueId: expectedLeagueId,
    publishedAt: root.publishedAt as string,
    snapshot: {
      id: requireString(snapshot.id, 'manifest.snapshot.id'),
      path,
      schemaVersion: CURRENT_PRICE_SNAPSHOT_SCHEMA,
      catalogRevision: requireString(snapshot.catalogRevision, 'manifest.snapshot.catalogRevision'),
      fetchedAt: validateIsoDate(snapshot.fetchedAt, 'manifest.snapshot.fetchedAt'),
      sha256: sha256.toLowerCase(),
      sizeBytes,
    },
  };
}

export function validateSnapshot(value: unknown, expectedLeagueId: string): PriceSnapshot {
  assertPriceSnapshot(value, expectedLeagueId);
  const root = requireObject(value, 'snapshot');
  if (root.schemaVersion !== CURRENT_PRICE_SNAPSHOT_SCHEMA) throw new Error('Unsupported price snapshot schema');
  if (root.provider !== 'poe.ninja') throw new Error('Unsupported price snapshot provider');
  if (root.leagueId !== expectedLeagueId) throw new Error('Pricing snapshot league does not match request');
  const fetchedAt = validateIsoDate(root.fetchedAt, 'snapshot.fetchedAt');
  const categories = requireObject(root.categories, 'snapshot.categories');
  for (const [category, index] of Object.entries(categories)) {
    const prices = requireObject(index, `snapshot.categories.${category}`);
    for (const [key, price] of Object.entries(prices)) {
      if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
        throw new Error(`snapshot.categories.${category}.${key} must be a finite non-negative number`);
      }
    }
  }
  return {
    schemaVersion: CURRENT_PRICE_SNAPSHOT_SCHEMA,
    provider: 'poe.ninja',
    leagueId: expectedLeagueId,
    fetchedAt,
    catalogRevision: root.catalogRevision as string,
    categories: categories as Partial<Record<string, PriceIndex>>,
  };
}

export class R2PricingTransport implements PricingTransport {
  private readonly fetcher: FetchLike;
  private readonly origin: string;
  private readonly timeoutMs: number;
  private readonly manifests = new Map<string, { etag?: string; manifest: PricingSnapshotManifest }>();
  private readonly snapshots = new Map<string, PriceSnapshot>();

  constructor({ baseUrl = DEFAULT_PRICING_PROXY_BASE_URL, fetcher = globalThis.fetch as unknown as FetchLike, timeoutMs = 15_000 } = {}) {
    this.origin = new URL(baseUrl).origin;
    this.fetcher = fetcher;
    this.timeoutMs = timeoutMs;
  }

  async getSnapshot(leagueId: string): Promise<PriceSnapshot> {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error(`Pricing proxy request timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
    });
    try {
      return await Promise.race([this.fetchSnapshot(leagueId, controller.signal), timedOut]);
    } finally {
      if (timeout) clearTimeout(timeout);
      controller.abort();
    }
  }

  private async fetchSnapshot(leagueId: string, signal: AbortSignal): Promise<PriceSnapshot> {
    const manifestUrl = `${this.origin}${manifestPath(leagueId)}`;
    const cached = this.manifests.get(leagueId);
    const manifestResponse = await this.fetcher(manifestUrl, {
      method: 'GET',
      signal,
      ...(cached?.etag ? { headers: { 'If-None-Match': cached.etag } } : {}),
    });
    let resolvedManifest: PricingSnapshotManifest;
    if (manifestResponse.status === 304 && cached) {
      resolvedManifest = cached.manifest;
    } else {
      if (!manifestResponse.ok) throw new Error(`Pricing manifest request failed (${manifestResponse.status})`);
      resolvedManifest = validateManifest(parseJson(await manifestResponse.text(), 'Pricing manifest'), leagueId);
    }
    this.manifests.set(leagueId, {
      etag: manifestResponse.headers.get('etag') ?? cached?.etag,
      manifest: resolvedManifest,
    });
    const snapshotCacheKey = `${leagueId}:${resolvedManifest.snapshot.id}`;
    const cachedSnapshot = this.snapshots.get(snapshotCacheKey);
    if (cachedSnapshot) return cachedSnapshot;

    const snapshotResponse = await this.fetcher(`${this.origin}${resolvedManifest.snapshot.path}`, { method: 'GET', signal });
    if (!snapshotResponse.ok) throw new Error(`Pricing snapshot request failed (${snapshotResponse.status})`);
    const compressed = Buffer.from(await snapshotResponse.arrayBuffer());
    if (compressed.byteLength > MAX_SNAPSHOT_BYTES) throw new Error('Pricing snapshot exceeds maximum download size');
    // Electron/undici may transparently decode gzip while retaining the response header.
    // Inspect the bytes instead of trusting Content-Encoding so a cached R2 object works in
    // both browser-like and raw-fetch runtimes.
    const uncompressed = compressed[0] === 0x1f && compressed[1] === 0x8b
      ? await gunzip(compressed)
      : compressed;
    if (uncompressed.byteLength !== resolvedManifest.snapshot.sizeBytes) throw new Error('Pricing snapshot size does not match manifest');
    const actualHash = crypto.createHash('sha256').update(uncompressed).digest('hex');
    if (actualHash !== resolvedManifest.snapshot.sha256) throw new Error('Pricing snapshot checksum does not match manifest');
    const serialized = uncompressed.toString('utf8');
    assertSnapshotHash(serialized, resolvedManifest.snapshot.sha256);
    const snapshot = validateSnapshot(parseJson(serialized, 'Pricing snapshot'), leagueId);
    this.snapshots.set(snapshotCacheKey, snapshot);
    return snapshot;
  }
}
