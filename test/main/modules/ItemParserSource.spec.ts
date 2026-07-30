import { jest } from '@jest/globals';

describe('ItemParser persistence contract', () => {
  it('awaits item insertion before the dependent ignore-state update', () => {
    const fs = jest.requireActual<typeof import('node:fs')>('node:fs');
    const path = jest.requireActual<typeof import('node:path')>('node:path');
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src', 'main', 'modules', 'ItemParser.js'),
      'utf8'
    );
    const insertIndex = source.indexOf('await DB.insertItems(itemsToInsert, eventId);');
    const ignoreUpdateIndex = source.indexOf(
      'await DB.updateIgnoredItems(formattedItemsForIgnoreManager);'
    );

    expect(insertIndex).toBeGreaterThan(-1);
    expect(ignoreUpdateIndex).toBeGreaterThan(insertIndex);
  });

  it('uses the atomic item and inventory-baseline repository operation', () => {
    const fs = jest.requireActual<typeof import('node:fs')>('node:fs');
    const path = jest.requireActual<typeof import('node:path')>('node:path');
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src', 'main', 'modules', 'ItemParser.js'),
      'utf8'
    );

    expect(source).toContain('await DB.insertItemsAndInventory(');
  });

  it('contains item pricing failures instead of aborting inventory persistence', () => {
    const fs = jest.requireActual<typeof import('node:fs')>('node:fs');
    const path = jest.requireActual<typeof import('node:path')>('node:path');
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src', 'main', 'modules', 'ItemParser.js'),
      'utf8'
    );

    expect(source).toContain('async function priceItem(item)');
    expect(source).toContain('return { value: 0, explanation: null };');
    expect(source).toContain('const { value, explanation } = await priceItem(item);');
  });
});
