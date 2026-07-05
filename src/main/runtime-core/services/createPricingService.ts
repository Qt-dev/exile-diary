import ItemPricer from '../../modules/ItemPricer';

export function createPricingService(itemPricer = ItemPricer) {
  return {
    getCurrencyByName: itemPricer.getCurrencyByName.bind(itemPricer),
    updateRates: itemPricer.updateRates.bind(itemPricer),
  };
}
