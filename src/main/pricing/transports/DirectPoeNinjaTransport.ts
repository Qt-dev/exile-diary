import PoeNinjaClient from '../poe-ninja/PoeNinjaClient';
import { POE_NINJA_CATEGORIES, type PoeNinjaCategory } from '../poe-ninja/categoryCatalog';
import { adaptPoeNinjaResponse, assembleLegacySnapshot } from '../poe-ninja/responseAdapters';
import { CURRENT_PRICE_SNAPSHOT_SCHEMA, type PriceSnapshot } from '../types';
import type { PricingTransport } from './PricingTransport';

/**
 * Development/test escape hatch. Production transport selection must never choose this class.
 */
export class DirectPoeNinjaTransport implements PricingTransport {
  async getSnapshot(leagueId: string, options: { force?: boolean } = {}): Promise<PriceSnapshot> {
    const categories: Record<string, Record<string, number>> = {};
    for (const [category, definition] of Object.entries(POE_NINJA_CATEGORIES)) {
      const response = await PoeNinjaClient.getCategory(category as PoeNinjaCategory, leagueId, {
        useCache: !options.force,
      });
      categories[category] = adaptPoeNinjaResponse(definition, response);
    }

    return {
      schemaVersion: CURRENT_PRICE_SNAPSHOT_SCHEMA,
      provider: 'poe.ninja',
      leagueId,
      fetchedAt: new Date().toISOString(),
      catalogRevision: 'direct-development',
      categories: assembleLegacySnapshot(categories, POE_NINJA_CATEGORIES),
    };
  }
}
