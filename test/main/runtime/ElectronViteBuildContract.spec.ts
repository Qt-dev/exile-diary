const fs = jest.requireActual('node:fs') as typeof import('node:fs');
const path = jest.requireActual('node:path') as typeof import('node:path');

const rootDir = path.resolve(__dirname, '../../..');

describe('electron-vite build contract', () => {
  it('keeps package scripts and entry outputs aligned with electron-vite', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
      main: string;
      scripts: Record<string, string>;
    };

    expect(packageJson.main).toBe('./out/electron/main/index.js');
    expect(packageJson.scripts.build).toBe('npm run build:app');
    expect(packageJson.scripts.start).toBe('electron-vite preview');
    expect(packageJson.scripts.dev).toContain('run-dev-with-recovery.mjs');
    expect(packageJson.scripts['dev:raw']).toContain('watch-electron-assets.mjs');
    expect(packageJson.scripts['dev:raw']).toContain('electron-vite dev');
    expect(packageJson.scripts['dev:raw']).toContain('electron-vite dev --watch');
    expect(packageJson.scripts).not.toHaveProperty('build_app');
    expect(packageJson.scripts).not.toHaveProperty('pack');
    expect(packageJson.scripts).not.toHaveProperty('dist');
    expect(packageJson.scripts['build:app']).toContain('electron-vite build');
    expect(packageJson.scripts['build:app']).toContain('sync:electron-assets');
    expect(packageJson.scripts['package:dir']).toContain('electron-builder --dir');
    expect(packageJson.scripts['test:app:smoke']).toContain('npm run build:app');
    expect(packageJson.scripts['test:packaged-sidecars']).toContain(
      'smoke-packaged-sidecars.mjs'
    );
    expect(packageJson.scripts['test:packaged-renderer']).toContain(
      'smoke-packaged-renderer.mjs'
    );
    expect(packageJson.dependencies).toHaveProperty('conf');
    expect(packageJson.dependencies).not.toHaveProperty('electron-store');
  });

  it('keeps build outputs and entrypoints defined in electron.vite.config.ts', () => {
    const viteConfig = fs.readFileSync(path.join(rootDir, 'electron.vite.config.ts'), 'utf8');

    expect(viteConfig).toContain("outDir: 'out/electron/main'");
    expect(viteConfig).toContain("outDir: 'out/electron/preload'");
    expect(viteConfig).toContain("outDir: 'out/renderer'");
    expect(viteConfig).toContain('src/main/index.ts');
    expect(viteConfig).toContain('src/main/modules/ImageParser/OcrSidecar.ts');
    expect(viteConfig).toContain('src/main/runtime/RuntimeSidecar.ts');
    expect(viteConfig).toContain('src/main/preload.ts');
  });

  it('keeps runtime sidecar client imports statically analyzable for bundling', () => {
    const mainIndex = fs.readFileSync(path.join(rootDir, 'src', 'main', 'index.ts'), 'utf8');
    const rendererService = fs.readFileSync(
      path.join(rootDir, 'src', 'main', 'services', 'RendererAppService.ts'),
      'utf8'
    );
    const sidecarBridge = fs.readFileSync(
      path.join(rootDir, 'src', 'main', 'runtime', 'createRuntimeSidecarBridge.ts'),
      'utf8'
    );

    expect(mainIndex).toContain(
      "import * as RuntimeSidecarClient from './runtime/RuntimeSidecarClient';"
    );
    expect(mainIndex).not.toContain("require('./runtime/RuntimeSidecarClient')");
    expect(rendererService).toContain(
      "import * as RuntimeSidecarClient from '../runtime/RuntimeSidecarClient';"
    );
    expect(rendererService).not.toContain("require('../runtime/RuntimeSidecarClient')");
    expect(sidecarBridge).toContain(
      "import * as RuntimeSidecarClient from './RuntimeSidecarClient';"
    );
    expect(sidecarBridge).not.toContain("require('./RuntimeSidecarClient')");
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

  it.each(['build-windows.yml', 'release.yml'])(
    'runs the packaged sidecar smoke before publishing Windows artifacts in %s',
    (workflowName) => {
      const workflow = fs.readFileSync(
        path.join(rootDir, '.github', 'workflows', workflowName),
        'utf8'
      );

      expect(workflow).toContain('npm run test:packaged-sidecars');
      expect(workflow).toContain('npm run test:packaged-renderer');
      expect(workflow.indexOf('npm run package:win')).toBeLessThan(
        workflow.indexOf('npm run test:packaged-sidecars')
      );
      expect(workflow.indexOf('npm run test:packaged-sidecars')).toBeLessThan(
        workflow.indexOf('Upload Artifact')
      );
      expect(workflow.indexOf('npm run test:packaged-renderer')).toBeLessThan(
        workflow.indexOf('Upload Artifact')
      );
    }
  );
});
