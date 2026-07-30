import { describe, expect, it } from '@jest/globals';
import { resolveR2Endpoint } from '../../../tools/poe-ninja-publisher/storage';

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
});
