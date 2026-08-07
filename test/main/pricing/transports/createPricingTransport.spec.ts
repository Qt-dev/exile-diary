import { createPricingTransport } from '../../../../src/main/pricing/transports/createPricingTransport';
import { DirectPoeNinjaTransport } from '../../../../src/main/pricing/transports/DirectPoeNinjaTransport';
import { R2PricingTransport } from '../../../../src/main/pricing/transports/R2PricingTransport';

describe('createPricingTransport', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDefaultApp = (process as any).defaultApp;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    (process as any).defaultApp = originalDefaultApp;
  });

  it('uses the proxy transport by default', () => {
    expect(createPricingTransport()).toBeInstanceOf(R2PricingTransport);
  });

  it('allows direct poe.ninja only outside packaged production', () => {
    process.env.NODE_ENV = 'test';
    (process as any).defaultApp = true;
    expect(createPricingTransport('direct')).toBeInstanceOf(DirectPoeNinjaTransport);
  });

  it('rejects direct poe.ninja in packaged production', () => {
    process.env.NODE_ENV = 'production';
    (process as any).defaultApp = false;
    expect(() => createPricingTransport('direct')).toThrow('disabled');
  });
});
