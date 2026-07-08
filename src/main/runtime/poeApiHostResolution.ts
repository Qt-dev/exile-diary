import dns from 'node:dns/promises';
import net from 'node:net';
import logger from 'electron-log';

export const poeApiHost = 'api.pathofexile.com';

type LookupAddress = {
  address: string;
};

type PoeApiResolution = {
  addresses: string[];
  badAddresses: string[];
};

type PoeApiResolutionGuardDeps = {
  lookup?: typeof dns.lookup;
};

const privateIpv4Ranges: Array<[number, number]> = [
  [0x0a000000, 0xff000000], // 10.0.0.0/8
  [0x7f000000, 0xff000000], // 127.0.0.0/8
  [0xa9fe0000, 0xffff0000], // 169.254.0.0/16
  [0xac100000, 0xfff00000], // 172.16.0.0/12
  [0xc0a80000, 0xffff0000], // 192.168.0.0/16
  [0x64400000, 0xffc00000], // 100.64.0.0/10
];

function ipv4ToInt(address: string) {
  const parts = address.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null;
  }

  return parts.reduce((accumulator, part) => (accumulator << 8) + part, 0) >>> 0;
}

export function isPrivateOrReservedAddress(address: string) {
  if (address === '0.0.0.0' || address === '::' || address === '::1') {
    return true;
  }

  const family = net.isIP(address);
  if (family === 4) {
    const numericAddress = ipv4ToInt(address);
    if (numericAddress === null) {
      return true;
    }

    return privateIpv4Ranges.some(
      ([rangeStart, mask]) => ((numericAddress & mask) >>> 0) === rangeStart
    );
  }

  if (family === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80') ||
      normalized === '::1'
    );
  }

  return true;
}

function normalizeLookupResult(results: LookupAddress[] | LookupAddress) {
  return Array.isArray(results) ? results : [results];
}

function createPoeApiResolutionError(resolution: PoeApiResolution) {
  const message =
    `Exile Diary could not reach the Path of Exile API because ${poeApiHost} resolved to ` +
    `${resolution.badAddresses.join(', ')} in this process. ` +
    'Check local DNS, proxy, VPN, and hosts-file overrides.';

  return new Error(message);
}

export function createPoeApiResolutionGuard(deps: PoeApiResolutionGuardDeps = {}) {
  const lookup = deps.lookup ?? dns.lookup;
  let cachedPromise: Promise<void> | null = null;

  async function resolveHost() {
    logger.info('Checking Path of Exile API host resolution', { host: poeApiHost });
    const lookupResult = await lookup(poeApiHost, { all: true });
    const addresses = normalizeLookupResult(lookupResult).map((entry) => entry.address);
    const badAddresses = addresses.filter(isPrivateOrReservedAddress);

    logger.info('Resolved Path of Exile API host', {
      addresses,
      badAddressCount: badAddresses.length,
      host: poeApiHost,
    });

    if (badAddresses.length > 0) {
      const error = createPoeApiResolutionError({ addresses, badAddresses });
      logger.error('Path of Exile API resolution is unhealthy', {
        addresses,
        badAddresses,
        host: poeApiHost,
      });
      throw error;
    }
  }

  return {
    ensurePoeApiHostResolution() {
      if (!cachedPromise) {
        cachedPromise = resolveHost();
      }

      return cachedPromise;
    },
    reset() {
      cachedPromise = null;
    },
  };
}

export const poeApiResolutionGuard = createPoeApiResolutionGuard();
