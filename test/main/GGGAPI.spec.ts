const axiosRequest = jest.fn();
const waitForAccountAccess = jest.fn(async () => undefined);
const waitForProfileAccess = jest.fn(async () => undefined);
const ensurePoeApiHostResolution = jest.fn(async () => undefined);
const getToken = jest.fn(async () => 'token');

jest.mock('electron-log', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: () => axiosRequest,
  },
}));

jest.mock('axios-cache-interceptor/dev', () => ({
  setupCache: () => axiosRequest,
  buildMemoryStorage: () => ({
    get: jest.fn(async () => null),
  }),
}));

jest.mock('bottleneck', () => {
  class FakeGroup {
    on() {}

    key(groupKey: string) {
      return {
        id: groupKey,
        updateSettings: jest.fn(),
        schedule: async (_options: unknown, callback: () => Promise<unknown>) => callback(),
      };
    }
  }

  return {
    __esModule: true,
    default: {
      Group: FakeGroup,
    },
  };
});

jest.mock('../../src/main/SettingsManager', () => ({
  __esModule: true,
  default: {
    settings: {
      username: 'Mapper',
      activeProfile: {
        characterName: 'AtlasRunner',
        league: 'Mirage',
      },
    },
    get: jest.fn((key: string) => {
      if (key === 'activeProfile') {
        return {
          characterName: 'AtlasRunner',
          league: 'Mirage',
          valid: true,
        };
      }

      return null;
    }),
  },
}));

jest.mock('../../src/main/AuthManager', () => ({
  __esModule: true,
  default: {
    getToken: (...args: unknown[]) => getToken(...args),
  },
}));

jest.mock('../../src/main/auth/AuthSessionReadiness', () => ({
  authSessionReadiness: {
    waitForAccountAccess: (...args: unknown[]) => waitForAccountAccess(...args),
    waitForProfileAccess: (...args: unknown[]) => waitForProfileAccess(...args),
  },
}));

jest.mock('../../src/main/runtime/poeApiHostResolution', () => ({
  poeApiResolutionGuard: {
    ensurePoeApiHostResolution: (...args: unknown[]) => ensurePoeApiHostResolution(...args),
  },
}));

describe('GGGAPI auth gating', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    ensurePoeApiHostResolution.mockResolvedValue(undefined);
  });

  it('waits for account access before loading all characters', async () => {
    axiosRequest.mockResolvedValue({
      cached: false,
      headers: {},
      data: {
        characters: [{ name: 'AtlasRunner', current: true, league: 'Mirage' }],
      },
    });

    const GGGAPI = (await import('../../src/main/GGGAPI')).default;
    await expect(GGGAPI.getAllCharacters()).resolves.toEqual([
      { name: 'AtlasRunner', current: true, league: 'Mirage' },
    ]);

    expect(waitForAccountAccess).toHaveBeenCalledTimes(1);
    expect(waitForProfileAccess).not.toHaveBeenCalled();
    expect(getToken).toHaveBeenCalledTimes(1);
    expect(ensurePoeApiHostResolution).toHaveBeenCalledTimes(1);
    expect(axiosRequest).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 15000, url: '/character' })
    );
  });

  it('coalesces concurrent character-list requests', async () => {
    axiosRequest.mockResolvedValue({
      cached: false,
      headers: {},
      data: {
        characters: [{ name: 'AtlasRunner', current: true, league: 'Mirage' }],
      },
    });

    const GGGAPI = (await import('../../src/main/GGGAPI')).default;
    const [first, second] = await Promise.all([
      GGGAPI.getAllCharacters(),
      GGGAPI.getAllCharacters(),
    ]);

    expect(first).toEqual(second);
    expect(axiosRequest).toHaveBeenCalledTimes(1);
  });

  it('shares a concurrent character snapshot between inventory and passive-tree consumers', async () => {
    axiosRequest.mockResolvedValue({
      cached: false,
      headers: {},
      data: {
        character: {
          inventory: [],
          equipment: [],
          experience: 123,
          passives: { hashes: [1], jewel_data: {} },
        },
      },
    });

    const GGGAPI = (await import('../../src/main/GGGAPI')).default;
    const [inventory, passives] = await Promise.all([
      GGGAPI.getDataForInventory(),
      GGGAPI.getSkillTree(),
    ]);

    expect(inventory.experience).toBe(123);
    expect(passives.hashes).toEqual([1]);
    expect(axiosRequest).toHaveBeenCalledTimes(1);
  });

  it('waits only for account access when resolving the current character', async () => {
    axiosRequest.mockResolvedValue({
      cached: false,
      headers: {},
      data: {
        characters: [
          { name: 'OldMapper', current: false, league: 'Ancestor' },
          { name: 'AtlasRunner', current: true, league: 'Mirage' },
        ],
      },
    });

    const GGGAPI = (await import('../../src/main/GGGAPI')).default;
    await expect(GGGAPI.getCurrentCharacter()).resolves.toEqual({
      name: 'AtlasRunner',
      current: true,
      league: 'Mirage',
    });

    expect(waitForAccountAccess).toHaveBeenCalledTimes(1);
    expect(waitForProfileAccess).not.toHaveBeenCalled();
    expect(ensurePoeApiHostResolution).toHaveBeenCalledTimes(1);
  });

  it('waits for profile access before loading stash tabs', async () => {
    axiosRequest.mockResolvedValue({
      cached: false,
      headers: {},
      data: {
        stashes: [{ id: 'currency', name: 'Currency' }],
      },
    });

    const GGGAPI = (await import('../../src/main/GGGAPI')).default;
    await expect(GGGAPI.getAllStashTabs()).resolves.toEqual([
      { id: 'currency', name: 'Currency' },
    ]);

    expect(waitForProfileAccess).toHaveBeenCalledTimes(1);
    expect(waitForAccountAccess).not.toHaveBeenCalled();
    expect(ensurePoeApiHostResolution).toHaveBeenCalledTimes(1);
  });

  it('surfaces a DNS resolution failure before making a doomed GGG request', async () => {
    ensurePoeApiHostResolution.mockRejectedValue(new Error('dns mismatch'));

    const GGGAPI = (await import('../../src/main/GGGAPI')).default;
    await expect(GGGAPI.getAllCharacters()).resolves.toEqual([]);

    expect(ensurePoeApiHostResolution).toHaveBeenCalledTimes(1);
    expect(axiosRequest).not.toHaveBeenCalled();
  });
});
