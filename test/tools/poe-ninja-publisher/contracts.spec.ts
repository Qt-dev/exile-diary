import { describe, expect, it } from '@jest/globals';
import { assertPricingManifest, canonicalJson, createManifest, leagueKey, sha256 } from '../../../src/shared/pricing';

describe('public pricing contract', () => {
  it('uses stable base64url league keys and deterministic object hashes', () => {
    expect(leagueKey('Hardcore Allflame')).toBe('SGFyZGNvcmUgQWxsZmxhbWU');
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
    expect(sha256('snapshot')).toMatch(/^[a-f0-9]{64}$/);
  });
  it('rejects manifests with an invalid snapshot hash', () => {
    const manifest = createManifest({ schemaVersion: 2, provider: 'poe.ninja', leagueId: 'Allflame', fetchedAt: '2026-07-29T12:00:00.000Z', catalogRevision: 'test', categories: {} }, '2026-07-29T12:00:00.000Z', 'id', 'a'.repeat(64), 1);
    assertPricingManifest(manifest, 'Allflame');
    expect(() => assertPricingManifest({ ...manifest, snapshot: { ...manifest.snapshot, sha256: 'bad' } })).toThrow('Invalid pricing manifest');
  });
});
