export type FixtureRateSnapshot = {
  league: string;
  date: string;
  rates: {
    Currency?: Record<string, number>;
    Fragment?: Record<string, number>;
  };
};

export type FixtureItem = {
  typeline: string;
  rarity?: string;
  category?: string;
  stack_size?: number;
};

export type FixturePricedItem = {
  typeline: string;
  stackSize: number;
  category: 'Currency' | 'Fragment' | 'Unknown';
  unitChaosValue: number;
  totalChaosValue: number;
};

function resolveFixtureItemCategory(item: FixtureItem): FixturePricedItem['category'] {
  if (item.category === 'Map Fragment') {
    return 'Fragment';
  }

  if (item.rarity === 'Currency') {
    return 'Currency';
  }

  return 'Unknown';
}

function resolveUnitChaosValue(item: FixtureItem, rateSnapshot: FixtureRateSnapshot): number {
  const category = resolveFixtureItemCategory(item);
  if (category === 'Currency') {
    return rateSnapshot.rates.Currency?.[item.typeline] ?? 0;
  }

  if (category === 'Fragment') {
    return rateSnapshot.rates.Fragment?.[item.typeline] ?? 0;
  }

  return 0;
}

export function priceFixtureItems(items: FixtureItem[], rateSnapshot: FixtureRateSnapshot) {
  const pricedItems = items
    .map((item) => {
      const category = resolveFixtureItemCategory(item);
      const stackSize = item.stack_size ?? 1;
      const unitChaosValue = resolveUnitChaosValue(item, rateSnapshot);

      return {
        typeline: item.typeline,
        stackSize,
        category,
        unitChaosValue,
        totalChaosValue: Number((unitChaosValue * stackSize).toFixed(2)),
      } satisfies FixturePricedItem;
    })
    .filter((item) => item.unitChaosValue > 0);

  const totalChaosValue = Number(
    pricedItems.reduce((sum, item) => sum + item.totalChaosValue, 0).toFixed(2)
  );

  return {
    itemsPriced: pricedItems.length,
    totalChaosValue,
    pricedItems,
  };
}
