jest.mock('electron-log', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

import {
  createPoeApiResolutionGuard,
  isPrivateOrReservedAddress,
  poeApiHost,
} from '../../../src/main/runtime/poeApiHostResolution';

describe('poeApiHostResolution', () => {
  it('treats private and sinkhole-style addresses as unhealthy', () => {
    expect(isPrivateOrReservedAddress('10.0.0.1')).toBe(true);
    expect(isPrivateOrReservedAddress('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedAddress('192.168.1.10')).toBe(true);
    expect(isPrivateOrReservedAddress('104.17.255.156')).toBe(false);
  });

  it('caches a healthy resolution and does not repeat lookup', async () => {
    const lookup = jest.fn(async () => [{ address: '104.17.255.156' }]);
    const guard = createPoeApiResolutionGuard({ lookup: lookup as any });

    await expect(guard.ensurePoeApiHostResolution()).resolves.toBeUndefined();
    await expect(guard.ensurePoeApiHostResolution()).resolves.toBeUndefined();

    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('throws a descriptive error when the host resolves to a private address', async () => {
    const lookup = jest.fn(async () => [{ address: '10.0.0.1' }]);
    const guard = createPoeApiResolutionGuard({ lookup: lookup as any });

    await expect(guard.ensurePoeApiHostResolution()).rejects.toThrow(
      new RegExp(poeApiHost.replace('.', '\\.') + '.*10\\.0\\.0\\.1')
    );
    expect(lookup).toHaveBeenCalledTimes(1);
  });
});
