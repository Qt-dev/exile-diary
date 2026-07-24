import { Item } from '../../src/renderer/stores/domain/item';

describe('renderer item API compatibility', () => {
  it('normalizes a 3.29 divination-card frame type for all raw-data consumers', () => {
    const item = new Item(
      { updateItemIgnoredStatus: () => {} },
      {
        enchantMods: [],
        explicitMods: [],
        frameTypeId: 'divination_card',
        h: 1,
        icon: 'https://example.invalid/card.png',
        id: 'card-3-29',
        identified: true,
        ilvl: 1,
        implicitMods: [],
        inventoryId: 'MainInventory',
        isIgnored: false,
        maxStackSize: 8,
        name: '',
        originalValue: 0,
        pickupStackSize: 1,
        replica: false,
        sockets: [],
        stackSize: 1,
        styleModifiers: {},
        synthesised: false,
        typeLine: 'The Doctor',
        value: 0,
        veiled: false,
        w: 1,
      }
    );

    expect(item.rawData.frameType).toBe(6);
    expect(item.itemClass).toBe('Divination Card');
  });
});
