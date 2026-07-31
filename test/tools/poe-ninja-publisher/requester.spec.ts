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
      `Exile-Diary-Reborn/${packageVersion} (pricing-publisher; +https://github.com/qt-dev/exile-diary)`,
      `Exile-Diary-Reborn/${packageVersion} (pricing-publisher; +https://github.com/qt-dev/exile-diary)`,
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
});
