const settingsGetMock = jest.fn();
const dbMock = {
  cleanRates: jest.fn(),
  hasExistingRates: jest.fn(),
  insertRates: jest.fn(),
  getFullRates: jest.fn(),
};

jest.mock('electron-log', () => ({
  scope: jest.fn(() => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  })),
}));

jest.mock('../../../src/main/SettingsManager', () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => settingsGetMock(...args),
    getAll: jest.fn(() => ({})),
  },
}));

jest.mock('../../../src/main/db/rates', () => ({
  __esModule: true,
  default: dbMock,
}));

describe('PricingService poe.ninja league names', () => {
  beforeEach(() => {
    jest.resetModules();
    settingsGetMock.mockReset();
    Object.values(dbMock).forEach((mock) => mock.mockReset());
  });

  it.each([
    ['Allflame', 'Allflame'],
    ['allflame', 'Allflame'],
    ['Curse of the Allflame', 'Allflame'],
    ['Hardcore Allflame', 'Hardcore Allflame'],
    ['Hardcore Curse of the Allflame', 'Hardcore Allflame'],
    ['Standard', 'Standard'],
  ])('normalizes %s to %s', (league, expected) => {
    const { normalizeNinjaLeagueName } = require('../../../src/main/pricing/PricingService');

    expect(normalizeNinjaLeagueName(league)).toBe(expected);
  });

  it('uses the canonical Allflame identifier in poe.ninja URLs', () => {
    settingsGetMock.mockReturnValue({
      league: 'Curse of the Allflame',
      leagueOverride: '',
    });
    const rateGetter = require('../../../src/main/pricing/PricingService').default;

    expect(rateGetter.getNinjaURL('Map')).toBe(
      '/poe1/api/economy/stash/current/item/overview?league=Allflame&type=Map'
    );
  });

  it('maps an Allflame SSF profile to the trade league', () => {
    settingsGetMock.mockReturnValue({
      league: 'HC SSF Allflame',
      leagueOverride: '',
      overrideSSF: true,
    });
    const rateGetter = require('../../../src/main/pricing/PricingService').default;

    expect(rateGetter.getNinjaLeagueName()).toBe('Hardcore Allflame');
  });

  it('writes a proxy snapshot to the existing daily SQLite history shape', async () => {
    jest.useFakeTimers();
    settingsGetMock.mockReturnValue({ league: 'Curse of the Allflame', leagueOverride: '' });
    dbMock.insertRates.mockResolvedValue(true);
    const rateGetter = require('../../../src/main/pricing/PricingService').default;
    rateGetter.setTransport({
      getSnapshot: jest.fn().mockResolvedValue({
        schemaVersion: 2,
        provider: 'poe.ninja',
        leagueId: 'Allflame',
        fetchedAt: '2026-07-29T12:00:00.000Z',
        catalogRevision: 'test',
        categories: { Currency: { Divine: 100 } },
      }),
    });

    await rateGetter.getRates('20260729');

    expect(dbMock.insertRates).toHaveBeenCalledWith(
      'Curse of the Allflame',
      '20260729',
      expect.objectContaining({ leagueId: 'Allflame', catalogRevision: 'test' })
    );
    jest.useRealTimers();
  });

  it('keeps local pricing ready when the proxy fails after an earlier snapshot exists', async () => {
    jest.useFakeTimers();
    settingsGetMock.mockReturnValue({ league: 'Allflame', leagueOverride: '' });
    dbMock.getFullRates.mockResolvedValue({ Currency: { Divine: 100 } });
    const rateGetter = require('../../../src/main/pricing/PricingService').default;
    rateGetter.setTransport({ getSnapshot: jest.fn().mockRejectedValue(new Error('proxy unavailable')) });

    await rateGetter.getRates('20260729');

    expect(rateGetter.ratesReady).toBe(true);
    expect(dbMock.getFullRates).toHaveBeenCalledWith('Allflame', '20260729');
    jest.useRealTimers();
  });
});
