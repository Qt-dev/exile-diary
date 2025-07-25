import { jest } from '@jest/globals';
import RunParser from '../../../src/main/modules/RunParser';
import DB from '../../../src/main/db';
import GGGAPI from '../../../src/main/GGGAPI';
import SettingsManager from '../../../src/main/SettingsManager';
import Utils from '../../../src/main/modules/Utils';
import { get } from '../../../src/main/db/settings';
import logger from 'electron-log';

jest.mock('../../../src/main/db', () => ({
  get: jest.fn(),
  all: jest.fn(),
  transaction: jest.fn(),
  run: jest.fn(),
}));
jest.mock('../../../src/main/GGGAPI', () => ({
  getDataForInventory: jest
    .fn()
    .mockReturnValue(Promise.resolve({ inventory: [], equipment: [], experience: 0 })),
}));
jest.mock('../../../src/main/SettingsManager', () => ({}));
jest.mock('../../../src/main/modules/Utils', () => ({}));
jest.mock('../../../src/main/modules/ItemPricer', () => ({
  price: jest.fn().mockReturnValue(Promise.resolve({ value: 0, count: 0, importantDrops: {} })),
}));
jest.mock('electron-log', () => ({
  scope: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
}));

describe('RunParser', () => {
  describe('setLatestGeneratedArea', () => {
    afterEach(() => {
      RunParser.setLatestGeneratedArea({ run_id: 1, level: 80, depth: 0, name: '' });
    });

    it('should set the latestGeneratedArea', () => {
      const areaInfo = { id: 1, name: 'test', run_id: 1, level: 70, depth: 0 };
      RunParser.setLatestGeneratedArea(areaInfo);
      expect(RunParser.latestGeneratedArea).toEqual(areaInfo);
    });

    it('should not set it up if there is no area argument', () => {
      const areaInfo = { id: 1, name: 'test' };
      RunParser.setLatestGeneratedArea({ run_id: 1, level: 80, depth: 0, name: '' });
      expect(RunParser.latestGeneratedArea).not.toEqual(areaInfo);
    });
  });

  describe('getAreaInfo', () => {
    beforeEach(() => {
      jest.spyOn(DB, 'get').mockReset();
    });

    it('should return the correct area info', async () => {
      const area = 'Area 1';
      jest.spyOn(DB, 'get').mockResolvedValue(area);
      const result = await RunParser.getAreaInfo(1);
      expect(result).toBe(area);
    });

    it('should return null if the DB call fails', async () => {
      jest.spyOn(DB, 'get').mockRejectedValue(new Error('DB Error'));
      const result = await RunParser.getAreaInfo(1);

      expect(result).toBeNull();
    });

    it('should return null if there is no result from the DB call', async () => {
      jest.spyOn(DB, 'get').mockResolvedValue(undefined);
      const result = await RunParser.getAreaInfo(1);
      expect(result).toBeNull();
    });
  });

  describe('getMapMods', () => {
    beforeEach(() => {
      jest.spyOn(DB, 'all').mockReset();
    });

    it('should return the correctly formatted map mods', async () => {
      const DBMods = [{ mod: 'mod1' }, { mod: 'mod2' }];
      jest.spyOn(DB, 'all').mockResolvedValue(DBMods);
      const expectedResults = DBMods.map(({ mod }) => mod);
      const result = await RunParser.getMapMods(1); // Pass a number as expected
      expect(result).toEqual(expectedResults);
    });

    it('should return an empty array if the DB call fails', async () => {
      jest.spyOn(DB, 'all').mockRejectedValue(new Error('DB Error'));
      const result = await RunParser.getMapMods(1); // Pass a number as expected
      expect(result).toEqual([]);
    });
  });

  describe('getXP', () => {
    beforeEach(() => {
      jest.spyOn(GGGAPI, 'getDataForInventory').mockReset();
      jest.spyOn(DB, 'get').mockReset();
    });

    it('should return the right XP', async () => {
      jest.spyOn(RunParser, 'getMapRun').mockResolvedValue({ first_event: '1', last_event: '2' });
      jest.spyOn(DB, 'get').mockResolvedValue({ xp: 100 });
      const xp = await RunParser.getXP(1, '2');
      expect(xp).toEqual(100);
    });

    it('should return value from API if the DB call fails', async () => {
      const expectedValue = 5;
      jest
        .spyOn(GGGAPI, 'getDataForInventory')
        .mockResolvedValue({ inventory: [], equipment: [], experience: expectedValue });
      jest.spyOn(DB, 'get').mockRejectedValue(new Error('DB Error'));
      const xp = await RunParser.getXP(1, '2');
      expect(xp).toEqual(expectedValue);
    });

    it('should return null if getXPManual fails', async () => {
      jest.spyOn(DB, 'get').mockRejectedValue(new Error('DB Error'));
      jest.spyOn(GGGAPI, 'getDataForInventory').mockRejectedValue(new Error('API Error'));
      const xp = await RunParser.getXP(1, '2');
      expect(xp).toBeNull();
    });
  });

  describe('updateItemValues', () => {
    beforeEach(() => {
      jest.spyOn(DB, 'transaction').mockReset();
    });

    it('should update the db with proper parameters', async () => {
      jest.spyOn(DB, 'transaction').mockImplementation(async (query, params) => {
        return Promise.resolve();
      });

      const items = [
        {
          id: 1,
          name: 'item1',
          typeline: 'White Item',
          rawdata: JSON.stringify({ inventoryId: 'MainInventory' }),
          category: 'Weapon',
          event_id: 1,
        },
        {
          id: 2,
          name: 'item2',
          typeline: 'White Item',
          rawdata: JSON.stringify({ inventoryId: 'MainInventory' }),
          category: 'Armor',
          event_id: 2,
        },
      ];

      await RunParser.updateItemValues(items);
      expect(DB.transaction).toHaveBeenCalledTimes(1);
      expect(DB.transaction).toHaveBeenCalledWith(expect.any(String), items);
    });
  });

  describe('parseItems', () => {
    beforeEach(() => {
      jest.spyOn(RunParser, 'updateItemValues').mockResolvedValue();
    });

    it('should return the right items data', async () => {
      const items = [
        {
          id: 1,
          name: 'item1',
          typeline: 'White Item',
          raw_data: JSON.stringify({ inventoryId: 'MainInventory' }),
          category: 'Weapon',
          event_id: 1,
        },
        {
          id: 2,
          name: 'item2',
          typeline: 'White Item',
          raw_data: JSON.stringify({ inventoryId: 'MainInventory' }),
          category: 'Armor',
          event_id: 2,
        },
      ];
      const expectedItems = {
        count: items.length,
        value: 0,
        importantDrops: {},
      };

      const parsedItems = await RunParser.parseItems(items);
      expect(parsedItems).toEqual(expectedItems);
    });
  });
});
