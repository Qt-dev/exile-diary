import React, { act } from 'react';
import { render, screen } from '@testing-library/react';
import { computed, observable, runInAction } from 'mobx';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/renderer/components/Item/Item', () => ({
  default: ({ item }: { item: { name: string } }) => <span>{item.name}</span>,
}));

vi.mock('../../src/renderer/components/Pricing/ChaosIcon', () => ({
  default: () => <span aria-hidden="true" />,
}));

const { default: StashTabs } = await import('../../src/renderer/routes/StashTabs');

const createStore = () => {
  const trackedStashTabs = observable.array<any>([]);
  const items = observable.array<any>([]);
  const itemsForLootTable = computed(() => items.slice());
  const getItemsForLootTable = vi.fn(() => itemsForLootTable.get());

  return {
    trackedStashTabs,
    itemStore: {
      items,
      getItemsForLootTable,
    },
    getStashTab(id: string) {
      return trackedStashTabs.find((stashTab) => stashTab.id === id) ?? null;
    },
  };
};

describe('StashTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows items when tracked tabs populate after the initial render', async () => {
    const store = createStore();

    store.itemStore.items.push({
      id: 'item-1',
      name: 'Ancient Orb',
      stashTabId: 'currency',
      quantity: 1,
      value: 10,
      totalValue: 10,
      item: { name: 'Ancient Orb' },
    });

    render(<StashTabs store={store} />);

    act(() => {
      runInAction(() => {
        store.trackedStashTabs.push({
          id: 'currency',
          name: 'Currency',
          metadata: {},
        });
      });
    });

    expect(await screen.findByText('Ancient Orb')).toBeInTheDocument();
    expect(store.itemStore.getItemsForLootTable).toHaveBeenCalledWith('name', 'desc', true);
  });
});
