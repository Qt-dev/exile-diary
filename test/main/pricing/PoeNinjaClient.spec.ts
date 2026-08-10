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

describe('PoeNinjaClient getItemMarketTrend gem disambiguation', () => {
  beforeEach(() => {
    jest.resetModules();
    axiosRequest.mockReset();
    axiosCreate.mockClear();
  });

  it('picks the base (non-corrupted, lowest level/quality) gem line, not an arbitrary expensive variant', async () => {
    // poe.ninja lists one line per gem level/quality/corruption variant under
    // the same name. Regression for a bug where the chart for a freshly
    // dropped base gem showed a corrupted max-level variant's price history
    // (e.g. 700-5000c) while the actual drop was correctly priced at ~179c.
    axiosRequest.mockImplementation(({ url }: { url: string }) => {
      if (url.includes('type=SkillGem') && url.includes('overview')) {
        return Promise.resolve({
          data: {
            lines: [
              {
                id: 111,
                detailsId: 'cast-on-ward-break-support-corrupted',
                name: 'Cast on Ward Break Support',
                gemLevel: 20,
                gemQuality: 23,
                corrupted: true,
                chaosValue: 5163,
              },
              {
                id: 222,
                detailsId: 'cast-on-ward-break-support-base',
                name: 'Cast on Ward Break Support',
                gemLevel: 1,
                gemQuality: 0,
                corrupted: false,
                chaosValue: 179.4,
              },
            ],
          },
        });
      }
      if (url.includes('history')) {
        return Promise.resolve({
          data: [{ daysAgo: 0, value: 179.4 }],
        });
      }
      return Promise.resolve({ data: { lines: [], items: [] } });
    });

    const client = require('../../../src/main/pricing/poe-ninja/PoeNinjaClient').default;
    const points = await client.getItemMarketTrend('Cast on Ward Break Support', 'Allflame');

    expect(points).toHaveLength(1);
    expect(points[0].price).toBe(179.4);

    const historyCall = axiosRequest.mock.calls.find(([opts]: [{ url: string }]) =>
      opts.url.includes('history')
    );
    expect(historyCall[0].url).toContain('id=222');
  });

  it('re-resolves the base gem variant via the itemMetaIndex populated by a prior getCategory call', async () => {
    // Regression: getCategory() indexes every stash-category line by name as
    // it's fetched (this happens routinely via getPricesCatalog/eagerSync,
    // long before any single-item lookup). The old index kept "whichever line
    // arrived first" permanently, so once a wrong (e.g. corrupted max-level)
    // variant won that race, getItemMarketTrend would serve its price history
    // forever, even after locateItemMeta's own disambiguation was fixed.
    axiosRequest.mockImplementation(({ url }: { url: string }) => {
      if (url.includes('type=SkillGem') && url.includes('overview')) {
        return Promise.resolve({
          data: {
            lines: [
              {
                id: 111,
                detailsId: 'cast-on-ward-break-support-corrupted',
                name: 'Cast on Ward Break Support',
                gemLevel: 20,
                gemQuality: 23,
                corrupted: true,
                chaosValue: 5163,
              },
              {
                id: 222,
                detailsId: 'cast-on-ward-break-support-base',
                name: 'Cast on Ward Break Support',
                gemLevel: 1,
                gemQuality: 0,
                corrupted: false,
                chaosValue: 179.4,
              },
            ],
          },
        });
      }
      if (url.includes('history')) {
        return Promise.resolve({ data: [{ daysAgo: 0, value: 179.4 }] });
      }
      return Promise.resolve({ data: { lines: [], items: [] } });
    });

    const client = require('../../../src/main/pricing/poe-ninja/PoeNinjaClient').default;

    // Simulate the catalog/eagerSync path indexing the category first.
    await client.getCategory('SkillGem', 'Allflame');

    const points = await client.getItemMarketTrend('Cast on Ward Break Support', 'Allflame');

    expect(points[0].price).toBe(179.4);
    const historyCall = axiosRequest.mock.calls.find(([opts]: [{ url: string }]) =>
      opts.url.includes('history')
    );
    expect(historyCall[0].url).toContain('id=222');
  });
});
