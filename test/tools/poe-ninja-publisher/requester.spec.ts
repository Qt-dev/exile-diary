import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { PoeNinjaRequester } from '../../../tools/poe-ninja-publisher/requester';

const packageVersion = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version;

describe('PoeNinjaRequester', () => {
  it('uses the economy league id rather than the display name', async () => {
    const requestUserAgents: string[] = [];
    const requester = new PoeNinjaRequester(async (_input, init) => {
      requestUserAgents.push(new Headers(init?.headers).get('user-agent') ?? '');
      return {
        status: 200,
        headers: new Headers(),
        json: async () => [{ id: 'Allflame', name: 'Curse of the Allflame' }],
      };
    });

    await expect(requester.getLeagues()).resolves.toEqual(['Allflame']);
    await requester.getCategory('Currency', 'Allflame');
    expect(requestUserAgents).toEqual([
      `Exile-Diary-Reborn/${packageVersion} (pricing-publisher; contact: https://github.com/qt-dev/exile-diary)`,
      `Exile-Diary-Reborn/${packageVersion} (pricing-publisher; contact: https://github.com/qt-dev/exile-diary)`,
    ]);
  });

  it('preserves a custom User-Agent override', async () => {
    let requestHeaders: Headers | undefined;
    const requester = new PoeNinjaRequester(
      async (_input, init) => {
        requestHeaders = new Headers(init?.headers);
        return { status: 200, headers: new Headers(), json: async () => [] };
      },
      { userAgent: 'custom-agent/1.0' }
    );

    await expect(requester.getLeagues()).resolves.toEqual([]);
    expect(requestHeaders?.get('user-agent')).toBe('custom-agent/1.0');
  });

  it('uses the configured contact in the default User-Agent', async () => {
    let requestHeaders: Headers | undefined;
    const previous = process.env.POE_NINJA_CONTACT;
    process.env.POE_NINJA_CONTACT = 'https://status.example.test/poe';
    try {
      const environmentRequester = PoeNinjaRequester.fromEnvironment(async (_input, init) => {
        requestHeaders = new Headers(init?.headers);
        return { status: 200, headers: new Headers(), json: async () => [] };
      });
      await environmentRequester.getLeagues();
    } finally {
      if (previous === undefined) delete process.env.POE_NINJA_CONTACT;
      else process.env.POE_NINJA_CONTACT = previous;
    }
    expect(requestHeaders?.get('user-agent')).toContain('contact: https://status.example.test/poe');
  });

  it('sends cached ETags and reuses a 304 response', async () => {
    let requestHeaders: Headers | undefined;
    const requester = new PoeNinjaRequester(async (_input, init) => {
      requestHeaders = new Headers(init?.headers);
      return { status: 304, headers: new Headers(), json: async () => ({}) };
    }, { minTimeMs: 0 });
    await expect(requester.getCategory('Currency', 'Allflame', 'etag-1')).resolves.toEqual({ unchanged: true, etag: 'etag-1' });
    expect(requestHeaders?.get('if-none-match')).toBe('etag-1');
  });

  it('does not retry permanent client errors', async () => {
    let calls = 0;
    const requester = new PoeNinjaRequester(async () => {
      calls += 1;
      return { status: 404, headers: new Headers(), json: async () => ({}) };
    }, { minTimeMs: 0, maxAttempts: 3 });
    await expect(requester.getLeagues()).rejects.toThrow('HTTP 404');
    expect(calls).toBe(1);
  });

  it('retries rate limits using Retry-After and protects league discovery', async () => {
    let calls = 0;
    const requester = new PoeNinjaRequester(async () => {
      calls += 1;
      if (calls === 1) return { status: 429, headers: new Headers({ 'Retry-After': '0' }), json: async () => ({}) };
      return { status: 200, headers: new Headers(), json: async () => [{ id: 'Allflame' }] };
    }, { minTimeMs: 0, maxAttempts: 2 });
    await expect(requester.getLeagues()).resolves.toEqual(['Allflame']);
    expect(calls).toBe(2);
  });
});
