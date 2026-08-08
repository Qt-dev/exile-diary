import { describe, expect, it } from '@jest/globals';
import { POE_NINJA_CATEGORIES, adaptPoeNinjaResponse } from '../../../src/shared/pricing';

describe('publisher poe.ninja adapters', () => {
  it('accepts every valid exchange line regardless of optional legacy count fields', () => {
    expect(
      adaptPoeNinjaResponse(POE_NINJA_CATEGORIES.Currency, {
        items: [
          { id: 'divine', name: 'Divine Orb' },
          { id: 'mirror', name: 'Mirror of Kalandra' },
        ],
        lines: [
          { id: 'divine', primaryValue: 175, count: 10 },
          { id: 'mirror', primaryValue: 100_000, count: 1 },
        ],
      })
    ).toEqual({ 'Divine Orb': 175, 'Mirror of Kalandra': 100_000 });
  });

  it('publishes both exact and bare-name keys for variant uniques', () => {
    expect(
      adaptPoeNinjaResponse(POE_NINJA_CATEGORIES.UniqueAccessory, {
        lines: [
          { name: "Doryani's Invitation", variant: 'Cold', chaosValue: 20 },
          { name: "Doryani's Invitation", variant: 'Fire', chaosValue: 35 },
        ],
      })
    ).toEqual({
      "Doryani's Invitation": 35,
      "Doryani's Invitation (Cold)": 20,
      "Doryani's Invitation (Fire)": 35,
    });
  });
});
