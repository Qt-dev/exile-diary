import path from 'path';
import { readFileSync } from 'node:fs';

describe('Stats page source contracts', () => {
  const readSource = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), 'utf8');

  it('does not use CommonJS require for shrine icons in the Vite renderer', () => {
    const source = readSource(
      'src',
      'renderer',
      'components',
      'Stats',
      'MainStats',
      'MainStats.tsx'
    );

    expect(source).not.toContain('require(');
    expect(source).toContain('import.meta.url');
  });

  it('does not pass keepMounted through to Stats tab panel DOM nodes', () => {
    const source = readSource('src', 'renderer', 'routes', 'Stats.tsx');

    expect(source).not.toContain('keepMounted');
  });

  it('waits for screenshot content and captures the full Stats scroll height', () => {
    const source = readSource('src', 'renderer', 'routes', 'Stats.tsx');

    expect(source).toContain('await new Promise<void>((resolve) => requestAnimationFrame');
    expect(source).toContain('getFullCaptureDimensions(captureTarget)');
    expect(source).toContain('height: captureHeight');
    expect(source).toContain('canvasHeight: captureHeight');
    expect(source).toContain("overflow: 'visible'");
  });
});
