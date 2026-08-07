import crypto from 'crypto';
import zlib from 'zlib';
import {
  R2PricingTransport,
  leagueKey,
  validateManifest,
  validateSnapshot,
  type FetchLike,
} from '../../../../src/main/pricing/transports/R2PricingTransport';

const leagueId = 'Allflame';
const snapshot = {
  schemaVersion: 2,
  provider: 'poe.ninja' as const,
  leagueId,
  fetchedAt: '2026-07-29T12:00:00.000Z',
  catalogRevision: 'test-catalog',
  categories: { Currency: { Divine: 120 } },
};

function response(body: string | Buffer, options: { status?: number; encoding?: string; etag?: string } = {}) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  return {
    ok: (options.status ?? 200) >= 200 && (options.status ?? 200) < 300,
    status: options.status ?? 200,
    headers: { get: (name: string) => {
      if (name.toLowerCase() === 'content-encoding') return options.encoding ?? null;
      if (name.toLowerCase() === 'etag') return options.etag ?? null;
      return null;
    } },
    text: async () => buffer.toString('utf8'),
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  };
}

describe('R2PricingTransport', () => {
  it('uses a base64url league key', () => {
    expect(leagueKey('Hardcore Allflame')).toBe('SGFyZGNvcmUgQWxsZmxhbWU');
  });

  it('fetches, verifies and decodes an immutable gzip snapshot', async () => {
    const serialized = JSON.stringify(snapshot);
    const checksum = crypto.createHash('sha256').update(serialized).digest('hex');
    const manifest = {
      protocolVersion: 1,
      leagueId,
      publishedAt: '2026-07-29T12:01:00.000Z',
      snapshot: {
        id: '20260729-test',
        path: `/v1/poe1/leagues/${leagueKey(leagueId)}/snapshots/20260729-test.json`,
        schemaVersion: 2,
        catalogRevision: 'test-catalog',
        fetchedAt: snapshot.fetchedAt,
        sha256: checksum,
        sizeBytes: Buffer.byteLength(serialized),
      },
    };
    const fetcher = jest.fn(async (url: string) =>
      url.endsWith('current.json') ? response(JSON.stringify(manifest)) : response(zlib.gzipSync(serialized), { encoding: 'gzip' })
    ) as unknown as FetchLike;

    const transport = new R2PricingTransport({ baseUrl: 'https://prices.example.test/v1', fetcher });
    await expect(transport.getSnapshot(leagueId)).resolves.toMatchObject(snapshot);
    expect(fetcher).toHaveBeenCalledWith(
      'https://prices.example.test/v1/poe1/leagues/QWxsZmxhbWU/current.json',
      expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) })
    );
  });

  it('rejects a snapshot with a manifest checksum mismatch', async () => {
    const serialized = JSON.stringify(snapshot);
    const manifest = {
      protocolVersion: 1,
      leagueId,
      publishedAt: '2026-07-29T12:01:00.000Z',
      snapshot: {
        id: 'bad', path: `/v1/poe1/leagues/${leagueKey(leagueId)}/snapshots/bad.json`, schemaVersion: 2,
        catalogRevision: 'test-catalog', fetchedAt: snapshot.fetchedAt,
        sha256: '0'.repeat(64), sizeBytes: Buffer.byteLength(serialized),
      },
    };
    const fetcher = jest.fn(async (url: string) =>
      url.endsWith('current.json') ? response(JSON.stringify(manifest)) : response(serialized)
    ) as unknown as FetchLike;
    await expect(new R2PricingTransport({ baseUrl: 'https://prices.example.test/v1', fetcher }).getSnapshot(leagueId)).rejects.toThrow('checksum');
  });

  it('accepts a transparently decompressed response that still carries a gzip header', async () => {
    const serialized = JSON.stringify(snapshot);
    const checksum = crypto.createHash('sha256').update(serialized).digest('hex');
    const manifest = {
      protocolVersion: 1, leagueId, publishedAt: '2026-07-29T12:01:00.000Z',
      snapshot: { id: 'decoded', path: `/v1/poe1/leagues/${leagueKey(leagueId)}/snapshots/decoded.json`, schemaVersion: 2,
        catalogRevision: 'test-catalog', fetchedAt: snapshot.fetchedAt, sha256: checksum, sizeBytes: Buffer.byteLength(serialized) },
    };
    const fetcher = jest.fn(async (url: string) =>
      url.endsWith('current.json') ? response(JSON.stringify(manifest)) : response(serialized, { encoding: 'gzip' })
    ) as unknown as FetchLike;

    await expect(new R2PricingTransport({ baseUrl: 'https://prices.example.test/v1', fetcher }).getSnapshot(leagueId)).resolves.toMatchObject(snapshot);
  });

  it('reuses a validated snapshot after a conditional manifest response', async () => {
    const serialized = JSON.stringify(snapshot);
    const checksum = crypto.createHash('sha256').update(serialized).digest('hex');
    const manifest = {
      protocolVersion: 1, leagueId, publishedAt: '2026-07-29T12:01:00.000Z',
      snapshot: { id: 'cached', path: `/v1/poe1/leagues/${leagueKey(leagueId)}/snapshots/cached.json`, schemaVersion: 2,
        catalogRevision: 'test-catalog', fetchedAt: snapshot.fetchedAt, sha256: checksum, sizeBytes: Buffer.byteLength(serialized) },
    };
    let manifestCalls = 0;
    const fetcher = jest.fn(async (url: string) => {
      if (url.endsWith('current.json')) {
        manifestCalls += 1;
        return manifestCalls === 1 ? response(JSON.stringify(manifest), { etag: '"current"' }) : response('', { status: 304 });
      }
      return response(serialized);
    }) as unknown as FetchLike;
    const transport = new R2PricingTransport({ baseUrl: 'https://prices.example.test/v1', fetcher });
    await transport.getSnapshot(leagueId);
    await expect(transport.getSnapshot(leagueId)).resolves.toMatchObject(snapshot);
    expect((fetcher as jest.Mock).mock.calls[2]).toEqual([
      'https://prices.example.test/v1/poe1/leagues/QWxsZmxhbWU/current.json',
      expect.objectContaining({
        method: 'GET',
        signal: expect.any(AbortSignal),
        headers: { 'If-None-Match': '"current"' },
      }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('times out stalled pricing requests', async () => {
    const fetcher = jest.fn(() => new Promise(() => undefined)) as unknown as FetchLike;
    const transport = new R2PricingTransport({
      baseUrl: 'https://prices.example.test/v1',
      fetcher,
      timeoutMs: 10,
    });

    await expect(transport.getSnapshot(leagueId)).rejects.toThrow('timed out');
    expect((fetcher as jest.Mock).mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('rejects manifest and snapshot league mismatches before using their data', () => {
    expect(() => validateManifest({ protocolVersion: 1, leagueId: 'Other', publishedAt: snapshot.fetchedAt, snapshot: {} }, leagueId)).toThrow();
    expect(() => validateSnapshot({ ...snapshot, leagueId: 'Other' }, leagueId)).toThrow();
  });
});
