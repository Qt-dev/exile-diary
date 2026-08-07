export type PriceIndex = Record<string, number>;

export type LegacyPriceSnapshot = Record<string, PriceIndex>;

export type PriceSnapshot = {
  schemaVersion: number;
  provider: 'poe.ninja';
  leagueId: string;
  fetchedAt: string;
  /** Revision of the shared poe.ninja category and identity catalog, when supplied by the proxy. */
  catalogRevision?: string;
  categories: Partial<Record<string, PriceIndex>>;
};

export const CURRENT_PRICE_SNAPSHOT_SCHEMA = 2;
