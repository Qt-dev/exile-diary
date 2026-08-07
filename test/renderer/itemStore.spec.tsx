import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/renderer/electron.service', () => ({
  electronService: {
    logger: {
      scope: () => ({
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
      }),
    },
    on: vi.fn(),
  },
}));

const { default: ItemStore } = await import('../../src/renderer/stores/itemStore');

describe('ItemStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('can include ignored items when building a stash table', () => {
    const store = new ItemStore([]);
    store.items = [
      {
        isIgnored: true,
        toLootTable: () => ({
          id: 'item-1',
          name: 'Ancient Orb',
          value: 10,
          originalValue: 10,
          totalValue: 10,
          quantity: 1,
          stackSize: 0,
          items: [],
        }),
      },
    ] as any;

    expect(store.getItemsForLootTable('name', 'desc')).toHaveLength(0);
    expect(store.getItemsForLootTable('name', 'desc', true)).toHaveLength(1);
  });
});
