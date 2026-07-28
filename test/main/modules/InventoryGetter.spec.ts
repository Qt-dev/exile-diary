import { jest } from '@jest/globals';
import InventoryGetter from '../../../src/main/modules/InventoryGetter';

jest.mock('../../../src/main/modules/GearChecker', () => ({
  check: jest.fn(),
}));
jest.mock('../../../src/main/modules/XPTracker', () => ({
  __esModule: true,
  default: {
    logXP: jest.fn(),
  },
}));
jest.mock('../../../src/main/modules/GraftbloodTracker', () => ({
  __esModule: true,
  default: {
    logGraftblood: jest.fn(),
  },
}));
jest.mock('../../../src/main/modules/KillTracker', () => ({
  __esModule: true,
  default: {
    logKillCount: jest.fn(),
  },
}));
jest.mock('../../../src/main/modules/settings', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => ({})),
  },
}));

describe('InventoryGetter capture contract', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('updates the inventory baseline only after the diff persists', async () => {
    const previousInventory = {
      existing: { id: 'existing', name: 'Chaos Orb', typeLine: 'Chaos Orb', stackSize: 1 },
    };
    const currentInventory = {
      existing: { id: 'existing', name: 'Chaos Orb', typeLine: 'Chaos Orb', stackSize: 2 },
    };
    jest.spyOn(InventoryGetter, 'getPreviousInventory').mockResolvedValue(previousInventory);
    jest.spyOn(InventoryGetter, 'getCurrentInventory').mockResolvedValue(currentInventory);
    const updateLastInventory = jest
      .spyOn(InventoryGetter, 'updateLastInventory')
      .mockResolvedValue(undefined);
    const persistDiff = jest.fn().mockRejectedValue(new Error('item insert failed'));

    await expect(
      InventoryGetter.captureInventoryDiff('2026-07-22T10:00:00.000Z', persistDiff)
    ).rejects.toThrow('item insert failed');

    expect(persistDiff).toHaveBeenCalledWith({
      existing: {
        id: 'existing',
        name: 'Chaos Orb',
        typeLine: 'Chaos Orb',
        stackSize: 1,
      },
    });
    expect(updateLastInventory).not.toHaveBeenCalled();
  });

  it('commits the inventory baseline after the diff persists', async () => {
    const currentInventory = {
      item: { id: 'item', name: 'Divine Orb', typeLine: 'Divine Orb' },
    };
    jest.spyOn(InventoryGetter, 'getPreviousInventory').mockResolvedValue({});
    jest.spyOn(InventoryGetter, 'getCurrentInventory').mockResolvedValue(currentInventory);
    const updateLastInventory = jest
      .spyOn(InventoryGetter, 'updateLastInventory')
      .mockResolvedValue(undefined);
    const persistDiff = jest.fn().mockResolvedValue(undefined);

    await expect(
      InventoryGetter.captureInventoryDiff('2026-07-22T10:00:00.000Z', persistDiff)
    ).resolves.toEqual(currentInventory);

    expect(persistDiff.mock.invocationCallOrder[0]).toBeLessThan(
      updateLastInventory.mock.invocationCallOrder[0]
    );
    expect(updateLastInventory).toHaveBeenCalledWith(currentInventory);
  });

  it('can return the diff and current inventory without advancing the baseline', async () => {
    const currentInventory = {
      item: { id: 'item', name: 'Divine Orb', typeLine: 'Divine Orb' },
    };
    jest.spyOn(InventoryGetter, 'getPreviousInventory').mockResolvedValue({});
    jest.spyOn(InventoryGetter, 'getCurrentInventory').mockResolvedValue(currentInventory);
    const updateLastInventory = jest.spyOn(InventoryGetter, 'updateLastInventory');

    await expect(
      InventoryGetter.getInventoryCapture('2026-07-22T10:00:00.000Z')
    ).resolves.toEqual({ diff: currentInventory, currentInventory });

    expect(updateLastInventory).not.toHaveBeenCalled();
  });

  it('serializes capture persistence across callers', async () => {
    let releaseFirst: (() => void) | undefined;
    const getInventoryCapture = jest
      .spyOn(InventoryGetter, 'getInventoryCapture')
      .mockResolvedValue({ diff: {}, currentInventory: {} });
    const firstPersist = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        })
    );
    const secondPersist = jest.fn().mockResolvedValue(undefined);

    const first = InventoryGetter.captureAndPersistInventory('first', firstPersist);
    const second = InventoryGetter.captureAndPersistInventory('second', secondPersist);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getInventoryCapture).toHaveBeenCalledTimes(1);
    expect(secondPersist).not.toHaveBeenCalled();

    releaseFirst?.();
    await Promise.all([first, second]);

    expect(getInventoryCapture).toHaveBeenCalledTimes(2);
    expect(secondPersist).toHaveBeenCalledTimes(1);
  });
});
