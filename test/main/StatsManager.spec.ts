jest.useFakeTimers();

jest.mock('../../src/main/db/repositories/stats', () => ({
  __esModule: true,
  default: {
    getAllRuns: jest.fn(),
    getAllItems: jest.fn(),
    getAllMapNames: jest.fn(),
    getAllPossibleMods: jest.fn(),
    getProfitPerHour: jest.fn(),
  },
}));

jest.mock('../../src/main/pricing/snapshots/PriceSnapshotStore', () => ({
  __esModule: true,
  default: {
    getCurrencyValue: jest.fn(),
  },
}));

jest.mock('../../src/main/SettingsManager', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

jest.mock('../../src/main/pricing/matching/ItemPricer', () => ({
  __esModule: true,
  default: {
    getCurrencyByName: jest.fn(),
  },
}));

import StatsManager from '../../src/main/StatsManager';
import DB from '../../src/main/db/repositories/stats';
import RatesManager from '../../src/main/pricing/snapshots/PriceSnapshotStore';
import SettingsManager from '../../src/main/SettingsManager';

const mockDB = DB as jest.Mocked<typeof DB>;
const mockRatesManager = RatesManager as jest.Mocked<typeof RatesManager>;
const mockSettingsManager = SettingsManager as jest.Mocked<typeof SettingsManager>;

describe('StatsManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsManager.get.mockReturnValue({ league: 'Settlers' });
    mockRatesManager.getCurrencyValue.mockResolvedValue(175);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('calculates run durations without relying on main process dayjs setup', async () => {
    mockDB.getAllRuns.mockResolvedValue([
      {
        id: 'run-1',
        name: 'Unknown Test Area',
        run_info: '{}',
        areaType: 'Other',
        first_event: '2026-07-09T19:13:00.000Z',
        last_event: '2026-07-09T19:14:30.000Z',
        gained: 90,
        kills: 12,
      } as any,
    ]);
    mockDB.getAllItems.mockResolvedValue([]);

    const stats = await StatsManager.getAllStats({ league: 'Settlers' });

    expect(stats.areas.Other.time).toBe(90);
    expect(stats.areas.Other.areas['Unknown Test Area'].maps[0]).toEqual(
      expect.objectContaining({
        id: 'run-1',
        time: 90,
      })
    );
  });
});
