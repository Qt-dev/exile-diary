import { gunzipSync, gzipSync } from 'node:zlib';
import { POE_NINJA_CATALOG_REVISION, POE_NINJA_CATEGORIES, adaptPoeNinjaResponse, assembleLegacySnapshot, canonicalJson, createLeague, createLeagueIndex, createManifest, manifestPath, normalizePoeNinjaLeagueName, sha256, snapshotPath, type PoeNinjaCategory, type PriceIndex, type PriceSnapshot } from '../../src/shared/pricing';
import { assertPriceSnapshot, assertPricingLeagueIndex, assertPricingManifest, assertSnapshotHash } from '../../src/shared/pricing/validation';
import type { PoeNinjaRequester } from './requester';
import type { PublisherStorage } from './storage';

const JSON_TYPE = 'application/json';
const snapshotHeaders = { contentType: JSON_TYPE, contentEncoding: 'gzip', cacheControl: 'public, max-age=31536000, immutable' };
type CategoryState = { etag?: string; value: unknown; catalogRevision: string };
const encoder = new TextEncoder(); const decoder = new TextDecoder();
const objectKey = (path: string) => path.replace(/^\//, '');

export class PricingPublisher {
  constructor(private readonly storage: PublisherStorage, private readonly requester: PoeNinjaRequester, private readonly now: () => Date = () => new Date(), private readonly catalogRevision = POE_NINJA_CATALOG_REVISION) {}
  private stateKey(league: string, category: PoeNinjaCategory) { return `_publisher/v1/${createLeague(league).key}/${category}.json`; }
  private async readState(league: string, category: PoeNinjaCategory): Promise<CategoryState | undefined> { const object = await this.storage.get(this.stateKey(league, category)); if (!object) return undefined; try { const state = JSON.parse(decoder.decode(object.bytes)) as CategoryState; return state.catalogRevision === this.catalogRevision ? state : undefined; } catch { return undefined; } }
  private async writeJson(path: string, value: unknown, headers: Record<string, string> = {}) { await this.storage.put(objectKey(path), { bytes: encoder.encode(canonicalJson(value)), ...headers }); }
  private async readPublishedLeagues() {
    const object = await this.storage.get('v1/poe1/leagues.json');
    if (!object) return [];
    const index = JSON.parse(decoder.decode(object.bytes));
    assertPricingLeagueIndex(index);
    return index.leagues;
  }
  async publishLeague(inputLeague: string, forceFullRefresh = false): Promise<{ published: boolean; snapshotId?: string }> {
    const league = normalizePoeNinjaLeagueName(inputLeague);
    const categories: Partial<Record<PoeNinjaCategory, PriceIndex>> = {};
    const states = new Map<PoeNinjaCategory, CategoryState>();
    const fetchedCategories = await Promise.all(
      (Object.keys(POE_NINJA_CATEGORIES) as PoeNinjaCategory[]).map(async (category) => {
        const prior = forceFullRefresh ? undefined : await this.readState(league, category);
        const result = await this.requester.getCategory(category, league, prior?.etag);
        const state: CategoryState = result.unchanged && prior
          ? prior
          : { etag: result.etag, value: result.body, catalogRevision: this.catalogRevision };
        if (!state.value || typeof state.value !== 'object') {
          throw new Error(`Missing ${category} category payload for ${league}`);
        }
        return { category, state, prices: adaptPoeNinjaResponse(POE_NINJA_CATEGORIES[category], state.value as any) };
      })
    );
    for (const { category, state, prices } of fetchedCategories) {
      states.set(category, state);
      categories[category] = prices;
    }
    const fetchedAt = this.now().toISOString();
    const snapshot: PriceSnapshot = {
      schemaVersion: 2,
      provider: 'poe.ninja',
      leagueId: league,
      fetchedAt,
      catalogRevision: this.catalogRevision,
      categories: assembleLegacySnapshot(categories, POE_NINJA_CATEGORIES),
    };
    assertPriceSnapshot(snapshot, league);
    const serialized = canonicalJson(snapshot); const hash = sha256(serialized); const id = `${fetchedAt.replace(/[:.]/g, '-')}-${hash.slice(0, 12)}`;
    const path = snapshotPath(league, id); const bytes = encoder.encode(serialized);
    await this.storage.put(objectKey(path), { bytes: gzipSync(bytes), ...snapshotHeaders, ifNoneMatch: '*' });
    // Verify exactly the uncompressed public contract before making it reachable through current.json.
    const uploaded = await this.storage.get(objectKey(path));
    if (!uploaded) throw new Error(`Snapshot upload could not be verified: ${path}`);
    const uploadedSerialized = decoder.decode(gunzipSync(uploaded.bytes));
    assertSnapshotHash(uploadedSerialized, hash);
    assertPriceSnapshot(JSON.parse(uploadedSerialized), league);
    const manifest = createManifest(snapshot, this.now().toISOString(), id, hash, bytes.byteLength);
    assertPricingManifest(manifest, league);
    for (const [category, state] of states) await this.writeJson(this.stateKey(league, category), state);
    await this.writeJson(manifestPath(league), manifest, { contentType: JSON_TYPE, cacheControl: 'public, max-age=300, stale-while-revalidate=900, stale-if-error=86400' });
    return { published: true, snapshotId: id };
  }
  async rollbackLeague(inputLeague: string, snapshotId: string): Promise<{ published: boolean; snapshotId: string }> {
    const league = normalizePoeNinjaLeagueName(inputLeague);
    const path = snapshotPath(league, snapshotId);
    const object = await this.storage.get(objectKey(path));
    if (!object) throw new Error(`Retained snapshot does not exist: ${snapshotId}`);
    const serialized = decoder.decode(gunzipSync(object.bytes));
    const snapshot = JSON.parse(serialized) as PriceSnapshot;
    assertPriceSnapshot(snapshot, league);
    const hash = sha256(serialized);
    const manifest = createManifest(snapshot, this.now().toISOString(), snapshotId, hash, encoder.encode(serialized).byteLength);
    assertPricingManifest(manifest, league);
    await this.writeJson(manifestPath(league), manifest, { contentType: JSON_TYPE, cacheControl: 'public, max-age=300, stale-while-revalidate=900, stale-if-error=86400' });
    return { published: true, snapshotId };
  }
  async publishLeagues(inputLeagues: readonly string[], forceFullRefresh = false): Promise<{ published: string[]; failed: Array<{ league: string; error: Error }> }> {
    const published: string[] = []; const failed: Array<{ league: string; error: Error }> = [];
    for (const league of inputLeagues) { try { await this.publishLeague(league, forceFullRefresh); published.push(normalizePoeNinjaLeagueName(league)); } catch (error) { failed.push({ league, error: error instanceof Error ? error : new Error(String(error)) }); } }
    if (published.length) {
      const merged = new Map((await this.readPublishedLeagues()).map((league) => [league.id, league]));
      for (const league of published) merged.set(league, createLeague(league));
      await this.writeJson('/v1/poe1/leagues.json', createLeagueIndex([...merged.values()], this.now().toISOString()), { contentType: JSON_TYPE, cacheControl: 'public, max-age=3600, stale-if-error=86400' });
    }
    return { published, failed };
  }
}
