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

  it('uses the proven canvas export path for strategy summary images', () => {
    const source = readSource('src', 'renderer', 'routes', 'Strategies.tsx');

    expect(source).toContain("import { toCanvas } from 'html-to-image'");
    expect(source).toContain("canvas.toDataURL('image/png')");
    expect(source).toContain("backgroundColor: '#000000'");
    expect(source).toContain('canvasWidth: 1000');
    expect(source).toContain('pixelRatio: 1');
    expect(source).not.toContain('canvasHeight:');
    expect(source).not.toContain('height: 1000');
    expect(source).not.toContain('toBlob(');
    expect(source).not.toContain('saveAs(');
  });

  it('uses exact font-face names in the strategy export subtree', () => {
    const strategiesCss = readSource('src', 'renderer', 'routes', 'Strategies.css');
    const globalCss = readSource('src', 'renderer', 'index.css');

    expect(strategiesCss).toContain('font-family: Fontin;');
    expect(strategiesCss).toContain('font-family: FontinSmallCaps;');
    expect(globalCss).not.toContain('font-family: FontIn;');
    expect(globalCss).not.toContain('font-family: FontInSmallCaps;');
    expect(strategiesCss).toContain('row-gap: 10px;');
    expect(strategiesCss).toContain('grid-template-rows: repeat(2, minmax(0, 1fr));');
  });

  it('uses the run-list semantic colors for strategy XP and deaths', () => {
    const source = readSource(
      'src',
      'renderer',
      'components',
      'Strategies',
      'StrategySummary.tsx'
    );

    expect(source).toContain('tone="positive"');
    expect(source).toContain('tone="negative"');
    expect(source).toContain('Strategies__SummaryMetricDetail');
  });

  it('includes the active character and league in strategy captures', () => {
    const route = readSource('src', 'renderer', 'routes', 'Strategies.tsx');
    const summary = readSource(
      'src',
      'renderer',
      'components',
      'Strategies',
      'StrategySummary.tsx'
    );

    expect(route).toContain('activeProfile?.characterName');
    expect(route).toContain('activeProfile?.league');
    expect(summary).toContain('Stats for');
    expect(summary).toContain('League');
    expect(summary).toContain('{includeFooter && (');
  });
});
