import path from 'path';
import { readFileSync } from 'node:fs';

describe('renderer boot startup fetches', () => {
  const readRendererEntry = () =>
    readFileSync(path.join(process.cwd(), 'src', 'renderer', 'index.jsx'), 'utf8');

  it('does not eagerly fetch characters or stash tabs during renderer boot', () => {
    const rendererEntry = readRendererEntry();

    expect(rendererEntry).not.toContain('characterStore.fetchCharacters();');
    expect(rendererEntry).not.toContain('stashTabStore.fetchStashTabs();');
  });

  it('checks preload availability before constructing backend-backed stores', () => {
    const rendererEntry = readRendererEntry();
    const preloadGuardIndex = rendererEntry.indexOf('if (!window.exileDiary)');
    const runStoreImportIndex = rendererEntry.indexOf("import('./stores/runStore')");

    expect(preloadGuardIndex).toBeGreaterThan(-1);
    expect(runStoreImportIndex).toBeGreaterThan(-1);
    expect(preloadGuardIndex).toBeLessThan(runStoreImportIndex);
    expect(rendererEntry).toContain('Exile Diary failed to start');
  });
});
