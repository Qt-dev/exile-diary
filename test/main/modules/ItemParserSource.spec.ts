import { jest } from '@jest/globals';

describe('ItemParser persistence contract', () => {
  it('awaits item insertion before the dependent ignore-state update', () => {
    const fs = jest.requireActual<typeof import('node:fs')>('node:fs');
    const path = jest.requireActual<typeof import('node:path')>('node:path');
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src', 'main', 'modules', 'ItemParser.js'),
      'utf8'
    );
    const insertIndex = source.indexOf('await DB.insertItems(itemsToInsert);');
    const ignoreUpdateIndex = source.indexOf(
      'await DB.updateIgnoredItems(formattedItemsForIgnoreManager);'
    );

    expect(insertIndex).toBeGreaterThan(-1);
    expect(ignoreUpdateIndex).toBeGreaterThan(insertIndex);
  });
});
