import { describe, expect, it } from '@jest/globals';
import { PoeNinjaRequester } from '../../../tools/poe-ninja-publisher/requester';

describe('PoeNinjaRequester', () => {
  it('uses the economy league id rather than the display name', async () => {
    const requester = new PoeNinjaRequester(async () => ({
      status: 200,
      headers: new Headers(),
      json: async () => [{ id: 'Allflame', name: 'Curse of the Allflame' }],
    }));

    await expect(requester.getLeagues()).resolves.toEqual(['Allflame']);
  });
});
