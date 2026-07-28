import { jest } from '@jest/globals';
import RunParser from '../../../src/main/modules/RunParser';
import DB from '../../../src/main/db';
import GGGAPI from '../../../src/main/GGGAPI';
import SettingsManager from '../../../src/main/SettingsManager';
import Utils from '../../../src/main/modules/Utils';
import { get } from '../../../src/main/db/settings';
import logger from 'electron-log';
import RunsDB from '../../../src/main/db/run';
import ItemPricer from '../../../src/main/modules/ItemPricer';
import InventoryGetter from '../../../src/main/modules/InventoryGetter';
import ItemParser from '../../../src/main/modules/ItemParser';

jest.mock('../../../src/main/db', () => ({
  get: jest.fn(),
  all: jest.fn(),
  transaction: jest.fn(),
  run: jest.fn(),
}));
jest.mock('../../../src/main/db/run', () => ({
  __esModule: true,
  default: {
    getLastMapGeneratedEvent: jest.fn(),
    updateLastEvent: jest.fn(),
  },
}));
jest.mock('../../../src/main/GGGAPI', () => ({
  getDataForInventory: jest
    .fn()
    .mockReturnValue(Promise.resolve({ inventory: [], equipment: [], experience: 0 })),
}));
jest.mock('../../../src/main/SettingsManager', () => ({}));
jest.mock('../../../src/main/modules/Utils', () => ({
  __esModule: true,
  default: {
    isTown: jest.fn(),
    isLabArea: jest.fn(),
    isVaalArea: jest.fn(),
    isLabTrial: jest.fn(),
    sleep: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../../src/main/modules/ItemPricer', () => ({
  price: jest.fn().mockReturnValue(Promise.resolve({ value: 0, count: 0, importantDrops: {} })),
}));
jest.mock('../../../src/main/modules/InventoryGetter', () => ({
  __esModule: true,
  default: {
    getInventoryDiffs: jest.fn().mockResolvedValue({}),
  },
}));
jest.mock('../../../src/main/modules/ItemParser', () => ({
  __esModule: true,
  default: {
    insertItems: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../../src/main/modules/LogProcessor', () => ({
  __esModule: true,
  default: {
    readLine: jest.fn((value) => value),
    reprocessEvents: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('electron-log', () => ({
  scope: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
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

    it('hydrates raw item fields and keeps pricing other drops when one item fails', async () => {
      const price = ItemPricer.price as jest.Mock;
      price
        .mockReset()
        .mockResolvedValueOnce({ isVendor: false, value: 12.5, explanation: null })
        .mockRejectedValueOnce(
          new TypeError("Cannot read properties of undefined (reading 'includes')")
        )
        .mockResolvedValueOnce({ isVendor: false, value: 3, explanation: null });
      const items = [
        {
          id: 1,
          name: '',
          typeline: 'Agate Amulet',
          raw_data: JSON.stringify({
            inventoryId: 'MainInventory',
            baseType: 'Agate Amulet',
          }),
          category: 'Amulets',
          event_id: 1,
        },
        {
          id: 2,
          name: '',
          typeline: 'Unknown Item',
          raw_data: JSON.stringify({ inventoryId: 'MainInventory' }),
          category: null,
          event_id: 1,
        },
        {
          id: 3,
          name: '',
          typeline: 'Chaos Orb',
          raw_data: JSON.stringify({
            inventoryId: 'MainInventory',
            baseType: 'Chaos Orb',
            stackSize: 3,
          }),
          category: 'Currency',
          event_id: 1,
        },
      ];

      await expect(RunParser.parseItems(items as any)).resolves.toEqual({
        count: 3,
        value: 15.5,
        importantDrops: {},
      });
      expect(price).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ baseType: 'Agate Amulet', typeline: 'Agate Amulet' })
      );
      expect(price).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ baseType: 'Chaos Orb', stack_size: 3 })
      );
      expect(RunParser.updateItemValues).toHaveBeenCalledWith([
        [12.5, null, 1, 1],
        [0, null, 2, 1],
        [3, null, 3, 1],
      ]);
    });
  });

  describe('getItemStats', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
      (Utils.sleep as jest.Mock).mockClear();
    });

    it('calculates automatic item stats without waiting for a future inventory snapshot', async () => {
      const itemStats = { count: 2, value: 12.5, importantDrops: {} };
      const getLastInventoryTimestamp = jest.spyOn(RunParser, 'getLastInventoryTimestamp');
      jest.spyOn(RunParser, 'generateItemStats').mockResolvedValue(itemStats);

      await expect(
        RunParser.getItemStats(
          { run_id: 123, name: 'Dunes Map' },
          '2026-07-22T09:00:00.000Z',
          '2026-07-22T09:59:55.000Z'
        )
      ).resolves.toEqual(itemStats);

      expect(RunParser.generateItemStats).toHaveBeenCalledWith(
        '123',
        '2026-07-22T09:00:00.000Z',
        '2026-07-22T09:59:55.000Z'
      );
      expect(getLastInventoryTimestamp).not.toHaveBeenCalled();
      expect(Utils.sleep).not.toHaveBeenCalled();
    });

    it('waits for a fresh inventory snapshot before calculating profit', async () => {
      const itemStats = { count: 2, value: 12.5, importantDrops: {} };
      jest
        .spyOn(RunParser, 'getLastInventoryTimestamp')
        .mockResolvedValueOnce('2026-07-22T09:58:00.000Z')
        .mockResolvedValueOnce('2026-07-22T10:00:00.000Z');
      jest.spyOn(RunParser, 'generateItemStats').mockResolvedValue(itemStats);

      await expect(
        RunParser.getItemStats(
          { run_id: 123, name: 'Dunes Map' },
          '2026-07-22T09:00:00.000Z',
          '2026-07-22T10:00:00.000Z',
          true
        )
      ).resolves.toEqual(itemStats);

      expect(Utils.sleep).toHaveBeenCalledWith(3000);
      expect(RunParser.generateItemStats).toHaveBeenCalledTimes(1);
    });

    it('defers item accounting when the inventory stays stale', async () => {
      jest
        .spyOn(RunParser, 'getLastInventoryTimestamp')
        .mockResolvedValue('2026-07-22T09:58:00.000Z');
      const generateItemStats = jest.spyOn(RunParser, 'generateItemStats');

      await expect(
        RunParser.getItemStats(
          { run_id: 123, name: 'Dunes Map' },
          '2026-07-22T09:00:00.000Z',
          '2026-07-22T10:00:00.000Z',
          true
        )
      ).resolves.toBe(false);

      expect(Utils.sleep).toHaveBeenCalledTimes(2);
      expect(generateItemStats).not.toHaveBeenCalled();
    });
  });

  describe('tryProcess completion', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
      (RunsDB.getLastMapGeneratedEvent as jest.Mock).mockResolvedValue({
        event_text: JSON.stringify({ areaName: 'Dunes Map' }),
      });
      (RunsDB.updateLastEvent as jest.Mock).mockResolvedValue(undefined);
      (Utils.isTown as jest.Mock).mockReturnValue(false);
      (Utils.isLabArea as jest.Mock).mockReturnValue(false);
      (Utils.isVaalArea as jest.Mock).mockReturnValue(false);
      (Utils.isLabTrial as jest.Mock).mockReturnValue(false);
      (InventoryGetter.getInventoryDiffs as jest.Mock).mockResolvedValue({});
      jest.spyOn(RunParser, 'getLatestUnusedMapEnteredEvents').mockResolvedValue([
        {
          timestamp: '2026-07-22T09:00:00.000Z',
          area: 'Dunes Map',
          server: '127.0.0.1:6112',
        },
      ]);
      jest.spyOn(RunParser, 'processRun').mockResolvedValue({
        name: 'Dunes Map',
        gained: 0,
        xp: 0,
        kills: 0,
        firstEvent: '2026-07-22T09:00:00.000Z',
        lastEvent: '2026-07-22T10:00:00.000Z',
      });
      jest.spyOn(RunParser, 'resetRunData').mockImplementation(() => undefined);
    });

    it('keeps the same-instance guard for automatic processing', async () => {
      await expect(
        RunParser.tryProcess({
          event: {
            timestamp: '2026-07-22T10:00:00.000Z',
            server: '127.0.0.1:6112',
          },
        })
      ).resolves.toBe(false);

      expect(RunParser.processRun).not.toHaveBeenCalled();
    });

    it('does not wait for or associate a future inventory snapshot during automatic completion', async () => {
      (RunsDB.getLastMapGeneratedEvent as jest.Mock).mockResolvedValue({
        event_text: JSON.stringify({ areaName: 'Strand Map' }),
      });

      await expect(
        RunParser.tryProcess({
          event: {
            timestamp: '2026-07-22T10:00:00.000Z',
            server: '127.0.0.1:6222',
          },
        })
      ).resolves.toBe(true);

      expect(InventoryGetter.getInventoryDiffs).not.toHaveBeenCalled();
      expect(ItemParser.insertItems).not.toHaveBeenCalled();
      expect(RunParser.processRun).toHaveBeenCalledWith(
        '2026-07-22T10:00:00.000Z',
        null,
        false
      );
    });

    it('completes the current run when explicitly requested in the same instance', async () => {
      await expect(
        RunParser.tryProcess({
          event: {
            timestamp: '2026-07-22T10:00:00.000Z',
            server: '127.0.0.1:6112',
          },
          reason: 'explicit-end',
          source: 'shortcut',
        })
      ).resolves.toBe(true);

      expect(RunParser.processRun).toHaveBeenCalledWith(
        '2026-07-22T10:00:00.000Z',
        null,
        true
      );
      expect(InventoryGetter.getInventoryDiffs).toHaveBeenCalledWith('2026-07-22T10:00:00.000Z');
    });

    it('persists the final inventory diff before explicit completion', async () => {
      const inventoryDiff = { 'item-1': { id: 'item-1', typeLine: 'Chaos Orb' } };
      (InventoryGetter.getInventoryDiffs as jest.Mock).mockResolvedValue(inventoryDiff);

      await expect(
        RunParser.tryProcess({
          event: {
            timestamp: '2026-07-22T10:00:00.000Z',
            server: '127.0.0.1:6112',
          },
          reason: 'explicit-end',
          source: 'shortcut',
        })
      ).resolves.toBe(true);

      expect(ItemParser.insertItems).toHaveBeenCalledWith(
        inventoryDiff,
        '2026-07-22T09:00:00.000Z'
      );
      expect(ItemParser.insertItems.mock.invocationCallOrder[0]).toBeLessThan(
        (RunParser.processRun as jest.Mock).mock.invocationCallOrder[0]
      );
    });

    it('leaves the run open when item accounting is not ready', async () => {
      jest.spyOn(RunParser, 'processRun').mockResolvedValue(false);
      const emit = jest.spyOn(RunParser.emitter, 'emit');

      await expect(
        RunParser.tryProcess({
          event: {
            timestamp: '2026-07-22T10:00:00.000Z',
            server: '127.0.0.1:6112',
          },
          reason: 'explicit-end',
          source: 'shortcut',
        })
      ).resolves.toBe(false);

      expect(emit).not.toHaveBeenCalledWith('run-parser:run-processed', expect.anything());
      expect(RunParser.resetRunData).not.toHaveBeenCalled();
    });

    it('retains special-zone safeguards for explicit completion', async () => {
      (RunsDB.getLastMapGeneratedEvent as jest.Mock).mockResolvedValue({
        event_text: JSON.stringify({ areaName: 'Azurite Mine' }),
      });
      jest.spyOn(RunParser, 'getLatestUnusedMapEnteredEvents').mockResolvedValue([
        {
          timestamp: '2026-07-22T09:00:00.000Z',
          area: 'Azurite Mine',
          server: '127.0.0.1:6112',
        },
      ]);

      await expect(
        RunParser.tryProcess({
          event: { timestamp: '2026-07-22T10:00:00.000Z' },
          reason: 'explicit-end',
          source: 'shortcut',
        })
      ).resolves.toBe(false);

      expect(RunParser.processRun).not.toHaveBeenCalled();
    });
  });
});
