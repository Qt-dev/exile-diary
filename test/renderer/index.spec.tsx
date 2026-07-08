import path from 'path';
import { readFileSync } from 'node:fs';

describe('renderer boot startup fetches', () => {
  it('does not eagerly fetch characters or stash tabs during renderer boot', () => {
    const rendererEntry = readFileSync(
      path.join(process.cwd(), 'src', 'renderer', 'index.jsx'),
      'utf8'
    );

    expect(rendererEntry).not.toContain('characterStore.fetchCharacters();');
    expect(rendererEntry).not.toContain('stashTabStore.fetchStashTabs();');
  });
});
