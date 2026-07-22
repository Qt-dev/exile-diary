import { createExplicitMapEndRequest, isMapEndSignal } from '../../../src/main/modules/mapEnd';

describe('map-end signals', () => {
  it.each([
    '@To <Mercenaries> AtlasRunner: end',
    '@From <Mercenaries> AtlasRunner: END',
    '@To AtlasRunner: end',
    'AtlasRunner: end',
  ])('recognizes an explicit end signal for the active character: %s', (content) => {
    expect(isMapEndSignal(content, 'AtlasRunner')).toBe(true);
  });

  it.each([
    '@To <Mercenaries> AnotherRunner: end',
    '@To <Mercenaries> AtlasRunner: ending',
    '@To <Mercenaries> AtlasRunner: end now',
    'The Maven: end',
  ])('rejects unrelated or inexact chat content: %s', (content) => {
    expect(isMapEndSignal(content, 'AtlasRunner')).toBe(false);
  });

  it('creates the same explicit completion contract used by chat and shortcuts', () => {
    expect(createExplicitMapEndRequest('2026-07-22T10:00:00.000Z', 'shortcut')).toEqual({
      event: { timestamp: '2026-07-22T10:00:00.000Z' },
      reason: 'explicit-end',
      source: 'shortcut',
    });
  });
});
