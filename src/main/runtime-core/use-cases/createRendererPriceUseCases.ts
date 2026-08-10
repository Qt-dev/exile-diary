import type { RendererPriceUseCaseDependencies } from '../rendererRuntimeDependencies';
import type { GetCatalogOptions, RecalculatePricesOptions } from '../../services/PricesService';

export function createRendererPriceUseCases(deps: RendererPriceUseCaseDependencies) {
  return {
    async getPricesCatalog(options?: GetCatalogOptions) {
      return deps.pricesService.getCatalog(options);
    },

    async getItemPriceDetails(itemIdentifier: string, league?: string) {
      return deps.pricesService.getItemPriceDetails(itemIdentifier, league);
    },

    async refreshItemPriceHistory(itemIdentifier: string, league?: string) {
      return deps.pricesService.getItemPriceDetails(itemIdentifier, league, { forceRefresh: true });
    },

    async addPriceOverride(params: {
      itemIdentifier: string;
      category?: string;
      price: number;
      currencyType?: 'chaos' | 'divine';
      inputPrice?: number;
      league?: string;
    }) {
      return deps.pricesService.setOverride(params);
    },

    async deletePriceOverride(itemIdentifier: string, league?: string) {
      return deps.pricesService.deleteOverride(itemIdentifier, league);
    },

    async recalculatePrices(options?: RecalculatePricesOptions) {
      return deps.pricesService.recalculatePrices(options);
    },
  };
}
