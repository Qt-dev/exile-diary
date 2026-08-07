import type { PriceSnapshot } from '../types';

/** A source of one complete, validated pricing snapshot. */
export interface PricingTransport {
  getSnapshot(leagueId: string, options?: { force?: boolean }): Promise<PriceSnapshot>;
}

export type PricingTransportKind = 'proxy' | 'direct' | 'fixture';

export const DEFAULT_PRICING_PROXY_BASE_URL = 'https://prices.exilediary.com/v1';
