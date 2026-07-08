const callRendererMethod = jest.fn();
const getSettingsSnapshot = jest.fn();
const getAllCharacters = jest.fn();

jest.mock('../../../src/main/runtime/RuntimeSidecarClient', () => ({
  callRendererMethod: (...args: unknown[]) => callRendererMethod(...args),
  getSettingsSnapshot: (...args: unknown[]) => getSettingsSnapshot(...args),
}));

const authManager = {
  getAuthInfo: jest.fn(),
  isAuthenticated: jest.fn(),
  logout: jest.fn(),
};

jest.mock('../../../src/main/AuthManager', () => ({
  __esModule: true,
  default: authManager,
}));

jest.mock('../../../src/main/GGGAPI', () => ({
  __esModule: true,
  default: {
    getAllCharacters: (...args: unknown[]) => getAllCharacters(...args),
  },
}));

describe('RendererAppService auth ownership', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    getSettingsSnapshot.mockReturnValue({});
  });

  it('gets OAuth info from the main process AuthManager instead of the runtime sidecar', async () => {
    authManager.getAuthInfo.mockReturnValue({
      code_challenge: 'challenge',
      code_verifier: 'verifier',
      state: 'state-from-main',
    });

    const { RendererAppService } = await import('../../../src/main/services/RendererAppService');
    const result = await RendererAppService.getOAuthInfo();

    expect(result).toEqual({
      code_challenge: 'challenge',
      code_verifier: 'verifier',
      state: 'state-from-main',
    });
    expect(authManager.getAuthInfo).toHaveBeenCalledTimes(1);
    expect(callRendererMethod).not.toHaveBeenCalledWith('getOAuthInfo', expect.anything());
  });

  it('checks auth state through the main process AuthManager', async () => {
    authManager.isAuthenticated.mockResolvedValue(true);
    getSettingsSnapshot.mockReturnValue({
      activeProfile: { characterName: 'SupaList', league: 'Mirage', valid: true },
    });

    const { RendererAppService } = await import('../../../src/main/services/RendererAppService');
    const result = await RendererAppService.isAuthenticated();

    expect(result).toBe(true);
    expect(authManager.isAuthenticated).toHaveBeenCalledWith(false, {
      activeProfile: { characterName: 'SupaList', league: 'Mirage', valid: true },
    });
    expect(callRendererMethod).not.toHaveBeenCalledWith('isAuthenticated', expect.anything());
  });

  it('logs out through the main process AuthManager', async () => {
    authManager.logout.mockResolvedValue(undefined);

    const { RendererAppService } = await import('../../../src/main/services/RendererAppService');
    await RendererAppService.logout();

    expect(authManager.logout).toHaveBeenCalledTimes(1);
    expect(callRendererMethod).not.toHaveBeenCalledWith('logout', expect.anything());
  });

  it('gets characters through the main process GGGAPI instead of the runtime sidecar', async () => {
    getAllCharacters.mockResolvedValue([{ name: 'Alice', league: 'Settlers' }]);

    const { RendererAppService } = await import('../../../src/main/services/RendererAppService');
    const result = await RendererAppService.getCharacters();

    expect(result).toEqual([{ name: 'Alice', league: 'Settlers' }]);
    expect(getAllCharacters).toHaveBeenCalledTimes(1);
    expect(callRendererMethod).not.toHaveBeenCalledWith('getCharacters', expect.anything());
  });
});
