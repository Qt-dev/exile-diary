import { FixtureItem, FixtureRateSnapshot, priceFixtureItems } from './priceFixtureItems';

export function valueFixtureStash(items: FixtureItem[], rateSnapshot: FixtureRateSnapshot) {
  const pricing = priceFixtureItems(items, rateSnapshot);

  return {
    snapshotId: pricing.snapshotId,
    currencyTotalChaos: pricing.totalChaosValue,
    itemsPriced: pricing.itemsPriced,
  };
}
