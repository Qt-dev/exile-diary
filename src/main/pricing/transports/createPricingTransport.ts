import { DirectPoeNinjaTransport } from './DirectPoeNinjaTransport';
import { R2PricingTransport } from './R2PricingTransport';
import type { PricingTransport, PricingTransportKind } from './PricingTransport';

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' && !process.defaultApp;
}

export function createPricingTransport(kind = process.env.EXILE_DIARY_PRICING_TRANSPORT): PricingTransport {
  const selected = (kind || 'proxy') as PricingTransportKind;
  if (selected === 'proxy') return new R2PricingTransport({ baseUrl: process.env.EXILE_DIARY_PRICING_BASE_URL });
  if (selected === 'direct') {
    if (isProduction()) throw new Error('Direct poe.ninja pricing is disabled in packaged builds');
    return new DirectPoeNinjaTransport();
  }
  if (selected === 'fixture') throw new Error('Fixture pricing transport must be injected explicitly');
  throw new Error(`Unsupported pricing transport: ${selected}`);
}
