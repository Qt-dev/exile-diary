const settingsGetMock = jest.fn();

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
  default: {},
}));

describe('RateGetterV2 poe.ninja league names', () => {
  beforeEach(() => {
    jest.resetModules();
    settingsGetMock.mockReset();
  });

  it.each([
    ['Allflame', 'Allflame'],
    ['allflame', 'Allflame'],
    ['Curse of the Allflame', 'Allflame'],
    ['Hardcore Allflame', 'Hardcore Allflame'],
    ['Hardcore Curse of the Allflame', 'Hardcore Allflame'],
    ['Standard', 'Standard'],
  ])('normalizes %s to %s', (league, expected) => {
    const { normalizeNinjaLeagueName } = require('../../../src/main/modules/RateGetterV2');

    expect(normalizeNinjaLeagueName(league)).toBe(expected);
  });

  it('uses the canonical Allflame identifier in poe.ninja URLs', () => {
    settingsGetMock.mockReturnValue({
      league: 'Curse of the Allflame',
      leagueOverride: '',
    });
    const rateGetter = require('../../../src/main/modules/RateGetterV2').default;

    expect(rateGetter.getNinjaURL('Map')).toBe(
      '/poe1/api/economy/stash/current/item/overview?type=Map&league=Allflame'
    );
  });

  it('maps an Allflame SSF profile to the trade league', () => {
    settingsGetMock.mockReturnValue({
      league: 'HC SSF Allflame',
      leagueOverride: '',
      overrideSSF: true,
    });
    const rateGetter = require('../../../src/main/modules/RateGetterV2').default;

    expect(rateGetter.getNinjaLeagueName()).toBe('Hardcore Allflame');
  });
});
