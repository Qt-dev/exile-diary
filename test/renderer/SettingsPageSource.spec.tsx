import path from 'path';
import { readFileSync } from 'node:fs';

describe('Settings page source contracts', () => {
  const readSource = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), 'utf8');

  it('does not use CommonJS require for stash tab icons in the Vite renderer', () => {
    const source = readSource(
      'src',
      'renderer',
      'components',
      'Settings',
      'StashSettings',
      'StashSettings.tsx'
    );

    expect(source).not.toContain('require(');
    expect(source).toContain('import.meta.glob');
  });

  it('does not use CommonJS require for item filter icons in the Vite renderer', () => {
    const source = readSource(
      'src',
      'renderer',
      'components',
      'Settings',
      'FilterSettings',
      'ItemFilterSettings.tsx'
    );

    expect(source).not.toContain('require(');
    expect(source).toContain('import.meta.glob');
  });
});
