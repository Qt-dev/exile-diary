import {
  getItemModDescriptions,
  getItemMods,
  getLegacyFrameType,
} from '../../src/helpers/poeItemApi';

describe('PoE item API compatibility helpers', () => {
  it('normalizes structured 3.29 modifiers while preserving their flags', () => {
    const mods = getItemMods([
      { description: '+42% to Fire Resistance', flags: { fractured: true } },
      { description: '+55 to maximum Life', flags: { crafted: true, vestigial: true } },
    ]);

    expect(mods).toEqual([
      { description: '+42% to Fire Resistance', flags: { fractured: true } },
      { description: '+55 to maximum Life', flags: { crafted: true, vestigial: true } },
    ]);
    expect(getItemModDescriptions(mods)).toEqual([
      '+42% to Fire Resistance',
      '+55 to maximum Life',
    ]);
  });

  it('continues to accept historical string modifier arrays and filters malformed entries', () => {
    expect(
      getItemModDescriptions([
        '+16 to maximum Life',
        { description: '+35% to Cold Resistance', flags: { mutated: true } },
        {} as never,
      ])
    ).toEqual(['+16 to maximum Life', '+35% to Cold Resistance']);
  });

  it('prefers frameTypeId, accepts documented spelling variants, and falls back to legacy frameType', () => {
    expect(getLegacyFrameType({ frameTypeId: 'rare', frameType: 3 })).toBe(2);
    expect(getLegacyFrameType({ frameTypeId: 'divination_card' })).toBe(6);
    expect(getLegacyFrameType({ frameTypeId: 'unknown-new-frame', frameType: 5 })).toBe(5);
    expect(getLegacyFrameType({ frameTypeId: 'unknown-new-frame' })).toBeUndefined();
  });
});
