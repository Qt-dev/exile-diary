const axiosRequest = jest.fn();
const axiosCreate = jest.fn(() => axiosRequest);

jest.mock('axios', () => ({
  __esModule: true,
  default: { create: axiosCreate },
}));

jest.mock('axios-cache-interceptor/dev', () => ({
  setupCache: (client: unknown) => client,
  buildMemoryStorage: () => ({}),
}));

jest.mock('bottleneck', () => ({
  __esModule: true,
  default: class FakeBottleneck {
    constructor(_options: unknown) {}

    schedule(_options: unknown, operation: () => Promise<unknown>) {
      return operation();
    }
  },
}));

jest.mock('electron-log', () => ({
  __esModule: true,
  default: { scope: () => ({ info: jest.fn() }) },
}));

describe('PoeNinjaClient User-Agent', () => {
  beforeEach(() => {
    jest.resetModules();
    axiosRequest.mockReset();
    axiosCreate.mockClear();
  });

  it('includes the current package version and project contact URL', async () => {
    const packageVersion = (require('../../../package.json') as { version: string }).version;
    axiosRequest.mockResolvedValue({ data: { lines: [] } });
    const client = require('../../../src/main/pricing/poe-ninja/PoeNinjaClient').default;

    await client.getCategory('Currency', 'Allflame');

    expect(axiosCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          'User-Agent': `Exile-Diary-Reborn/${packageVersion} (poe.ninja pricing; +https://github.com/qt-dev/exile-diary)`,
        },
      })
    );
  });
});
