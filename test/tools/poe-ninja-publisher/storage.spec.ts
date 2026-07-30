import { describe, expect, it } from '@jest/globals';
import { R2StorageTarget, resolveR2Endpoint } from '../../../tools/poe-ninja-publisher/storage';

class GetObjectCommand {
  constructor(readonly input: Record<string, unknown>) {}
}

class PutObjectCommand {
  constructor(readonly input: Record<string, unknown>) {}
}

describe('publisher R2 storage', () => {
  it('honors a configured endpoint', () => {
    expect(resolveR2Endpoint('account-id', 'https://jurisdiction.example.test')).toBe(
      'https://jurisdiction.example.test'
    );
  });

  it('falls back to the account endpoint', () => {
    expect(resolveR2Endpoint('account-id', '')).toBe(
      'https://account-id.r2.cloudflarestorage.com'
    );
  });

  it('constructs AWS SDK commands before sending them', async () => {
    const send = jest.fn(async (command: unknown) => {
      if (command instanceof GetObjectCommand) {
        return {
          Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
          ContentType: 'application/json',
        };
      }
      return {};
    });
    const storage = new R2StorageTarget({
      client: { send },
      bucket: 'pricing',
      commandFactory: { GetObjectCommand, PutObjectCommand },
    });

    await expect(storage.get('/v1/current.json')).resolves.toMatchObject({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'application/json',
    });
    await storage.put('/v1/current.json', {
      bytes: new Uint8Array([4, 5, 6]),
      contentType: 'application/json',
    });

    expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
    expect((send.mock.calls[0][0] as GetObjectCommand).input).toMatchObject({
      Bucket: 'pricing',
      Key: 'v1/current.json',
    });
    expect(send.mock.calls[1][0]).toBeInstanceOf(PutObjectCommand);
  });
});
