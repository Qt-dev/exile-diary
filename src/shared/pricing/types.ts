export type PriceIndex = Record<string, number>;

export type LegacyPriceSnapshot = Record<string, PriceIndex>;

export const CURRENT_PRICE_SNAPSHOT_SCHEMA = 2 as const;
export const PRICING_PROTOCOL_VERSION = 1 as const;

/** The normalized, provider-neutral payload stored in an immutable public object. */
export type PriceSnapshot = {
  schemaVersion: typeof CURRENT_PRICE_SNAPSHOT_SCHEMA;
  provider: 'poe.ninja';
  leagueId: string;
  fetchedAt: string;
  catalogRevision: string;
  categories: Partial<Record<string, PriceIndex>>;
};

export type PricingLeague = {
  id: string;
  name: string;
  key: string;
  manifestPath: string;
};

export type PricingLeagueIndex = {
  protocolVersion: typeof PRICING_PROTOCOL_VERSION;
  generatedAt: string;
  leagues: PricingLeague[];
};

export type PricingSnapshotManifest = {
  protocolVersion: typeof PRICING_PROTOCOL_VERSION;
  leagueId: string;
  publishedAt: string;
  snapshot: {
    id: string;
    path: string;
    schemaVersion: typeof CURRENT_PRICE_SNAPSHOT_SCHEMA;
    catalogRevision: string;
    fetchedAt: string;
    sha256: string;
    sizeBytes: number;
  };
};
