import type { PriceSnapshot } from '../types';
import type { PricingTransport } from './PricingTransport';

/** Deterministic transport intended for tests and local development. */
export class FixturePricingTransport implements PricingTransport {
  constructor(private readonly fixture: PriceSnapshot | ((leagueId: string) => PriceSnapshot)) {}

  async getSnapshot(leagueId: string): Promise<PriceSnapshot> {
    const snapshot = typeof this.fixture === 'function' ? this.fixture(leagueId) : this.fixture;
    return JSON.parse(JSON.stringify(snapshot)) as PriceSnapshot;
  }
}
