import path from 'path';
import { readFileSync } from 'node:fs';

describe('renderer asset loading contracts', () => {
  const readSource = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), 'utf8');

  it('does not use CommonJS require for run event icons', () => {
    const source = readSource('src', 'renderer', 'components', 'RunEvent', 'RunEventIcons.tsx');

    expect(source).not.toContain('require(');
    expect(source).toContain("import.meta.glob('../../assets/img/shrineicons/*.png'");
    expect(source).toContain("import.meta.glob('../../assets/img/metamorphicons/*.png'");
  });

  it('does not use CommonJS require for item influence backgrounds', () => {
    const source = readSource('src', 'renderer', 'components', 'Item', 'ItemTooltip.tsx');

    expect(source).not.toContain('require(');
    expect(source).toContain("import.meta.glob('../../../assets/img/itemicons/*Background*.png'");
  });
});
