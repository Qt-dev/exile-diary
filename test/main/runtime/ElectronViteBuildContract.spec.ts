const fs = jest.requireActual('node:fs') as typeof import('node:fs');
const path = jest.requireActual('node:path') as typeof import('node:path');

const rootDir = path.resolve(__dirname, '../../..');

describe('electron-vite build contract', () => {
  it('keeps package scripts and entry outputs aligned with electron-vite', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
    ) as {
      main: string;
      scripts: Record<string, string>;
    };

    expect(packageJson.main).toBe('./out/electron/main/index.js');
    expect(packageJson.scripts.start).toBe('electron-vite preview');
    expect(packageJson.scripts.dev).toContain('watch-electron-assets.mjs');
    expect(packageJson.scripts.dev).toContain('electron-vite dev');
    expect(packageJson.scripts).not.toHaveProperty('build');
    expect(packageJson.scripts).not.toHaveProperty('build_app');
    expect(packageJson.scripts['build:app']).toContain('electron-vite build');
    expect(packageJson.scripts['build:app']).toContain('sync:electron-assets');
    expect(packageJson.scripts['test:app:smoke']).toContain('npm run build:app');
  });

  it('keeps build outputs and entrypoints defined in electron.vite.config.ts', () => {
    const viteConfig = fs.readFileSync(path.join(rootDir, 'electron.vite.config.ts'), 'utf8');

    expect(viteConfig).toContain("outDir: 'out/electron/main'");
    expect(viteConfig).toContain("outDir: 'out/electron/preload'");
    expect(viteConfig).toContain("outDir: 'out/renderer'");
    expect(viteConfig).toContain('src/main/index.ts');
    expect(viteConfig).toContain('src/main/modules/ImageParser/OcrSidecar.ts');
    expect(viteConfig).toContain('src/main/preload.ts');
  });

  it('keeps copied runtime assets in their expected post-build locations', () => {
    const syncScript = fs.readFileSync(
      path.join(rootDir, 'scripts', 'sync-electron-assets.mjs'),
      'utf8'
    );
    const watchScript = fs.readFileSync(
      path.join(rootDir, 'scripts', 'watch-electron-assets.mjs'),
      'utf8'
    );

    expect(syncScript).toContain("'out', 'electron', 'db', 'extensions'");
    expect(syncScript).toContain("'out', 'electron', 'main'");
    expect(syncScript).toContain("'workerWrapper.js'");
    expect(syncScript).toContain("'ImageSaverWorker.js'");
    expect(syncScript).toContain("'OcrPipelineWorker.js'");
    expect(watchScript).toContain('syncElectronAssets');
    expect(watchScript).toContain('watch-electron-assets');
    expect(watchScript).toContain("'src', 'main', 'db', 'extensions'");
    expect(watchScript).toContain("'src', 'main', 'modules', 'ImageParser'");
  });
});
