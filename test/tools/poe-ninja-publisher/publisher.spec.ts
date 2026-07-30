import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from '@jest/globals';
import { assertPriceSnapshot, leagueKey, sha256 } from '../../../src/shared/pricing';
import { PricingPublisher } from '../../../tools/poe-ninja-publisher/publisher';
import { LocalFilesystemStorage } from '../../../tools/poe-ninja-publisher/storage';

const fixedNow = () => new Date('2026-07-29T12:00:00.000Z');
const categoryResponse = { lines: [{ name: 'Divine Orb', chaosValue: 1, primaryValue: 1 }] };

class FakeRequester {
  public failCategory?: string;
  async getCategory(category: string) {
    if (category === this.failCategory) throw new Error('upstream failed');
    return { unchanged: false, etag: `etag-${category}`, body: categoryResponse };
  }
}

describe('PricingPublisher', () => {
  it('publishes gzip immutable snapshot before its current manifest', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pricing-publisher-'));
    const publisher = new PricingPublisher(new LocalFilesystemStorage(root), new FakeRequester() as any, fixedNow);
    const result = await publisher.publishLeagues(['Allflame']);
    expect(result).toEqual({ published: ['Allflame'], failed: [] });
    const key = leagueKey('Allflame');
    const manifest = JSON.parse(await readFile(join(root, 'v1', 'poe1', 'leagues', key, 'current.json'), 'utf8'));
    const compressed = await readFile(join(root, manifest.snapshot.path.replace(/^\//, '')));
    const serialized = gunzipSync(compressed).toString('utf8');
    expect(sha256(serialized)).toBe(manifest.snapshot.sha256);
    const snapshot = JSON.parse(serialized);
    assertPriceSnapshot(snapshot, 'Allflame');
    expect(snapshot.catalogRevision).toBeTruthy();
    expect(snapshot.categories.Currency).toBeDefined();
    expect(snapshot.categories.UniqueItem).toBeDefined();
    expect(snapshot.categories.UniqueWeapon).toBeUndefined();
    expect(JSON.parse(await readFile(join(root, 'v1', 'poe1', 'leagues.json'), 'utf8')).leagues).toHaveLength(1);
  });

  it('keeps the prior public manifest when a later refresh is incomplete', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pricing-publisher-'));
    const requester = new FakeRequester();
    const publisher = new PricingPublisher(new LocalFilesystemStorage(root), requester as any, fixedNow);
    await publisher.publishLeagues(['Allflame']);
    const manifestPath = join(root, 'v1', 'poe1', 'leagues', leagueKey('Allflame'), 'current.json');
    const before = await readFile(manifestPath, 'utf8');
    requester.failCategory = 'Currency';
    const result = await publisher.publishLeagues(['Allflame']);
    expect(result.published).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(await readFile(manifestPath, 'utf8')).toBe(before);
  });

  it('rolls a league manifest back to a retained immutable snapshot', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pricing-publisher-'));
    const publisher = new PricingPublisher(new LocalFilesystemStorage(root), new FakeRequester() as any, fixedNow);
    const first = await publisher.publishLeague('Allflame');
    await publisher.rollbackLeague('Allflame', first.snapshotId!);
    const manifest = JSON.parse(await readFile(join(root, 'v1', 'poe1', 'leagues', leagueKey('Allflame'), 'current.json'), 'utf8'));
    expect(manifest.snapshot.id).toBe(first.snapshotId);
  });

  it('keeps retained leagues in the global index during a partial publication', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pricing-publisher-'));
    const publisher = new PricingPublisher(new LocalFilesystemStorage(root), new FakeRequester() as any, fixedNow);
    await publisher.publishLeagues(['Allflame', 'Standard']);
    await publisher.publishLeagues(['Allflame']);

    const index = JSON.parse(await readFile(join(root, 'v1', 'poe1', 'leagues.json'), 'utf8'));
    expect(index.leagues.map((league: { id: string }) => league.id)).toEqual(['Allflame', 'Standard']);
  });
});
