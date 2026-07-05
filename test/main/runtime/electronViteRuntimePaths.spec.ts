import path from 'node:path';
import {
  getBundledDbExtensionsPath,
  getImageParserWorkerBasePath,
  getPreloadBundlePath,
  getRendererIndexPath,
} from '../../../src/main/runtime/electronViteRuntimePaths';

describe('electron-vite runtime paths', () => {
  const repoRoot = path.resolve('workspace', 'exile-diary');
  const bundledMainDir = path.join(repoRoot, 'out', 'electron', 'main');

  it('resolves the preload bundle outside the main bundle directory', () => {
    const preloadPath = getPreloadBundlePath(bundledMainDir);

    expect(preloadPath).toContain(path.join('out', 'electron', 'main'));
    expect(preloadPath).toContain('preload');
    expect(preloadPath).toContain('index.js');
  });

  it('resolves the packaged renderer index outside the main bundle directory', () => {
    const rendererIndexPath = getRendererIndexPath(bundledMainDir);

    expect(rendererIndexPath).toContain(path.join('out', 'electron', 'main'));
    expect(rendererIndexPath).toContain('renderer');
    expect(rendererIndexPath).toContain('index.html');
  });

  it('resolves copied DB extensions under the electron output tree', () => {
    const dbExtensionsPath = getBundledDbExtensionsPath(bundledMainDir);

    expect(dbExtensionsPath).toContain(path.join('out', 'electron', 'main'));
    expect(dbExtensionsPath).toContain('db');
    expect(dbExtensionsPath).toContain('extensions');
  });

  it('uses source worker files during dev', () => {
    expect(
      getImageParserWorkerBasePath({
        currentMainDir: bundledMainDir,
        cwd: repoRoot,
        isDev: true,
      })
    ).toContain(path.join('src', 'main', 'modules', 'ImageParser'));
  });

  it('uses copied worker files from the built main output outside dev', () => {
    expect(
      getImageParserWorkerBasePath({
        currentMainDir: bundledMainDir,
        cwd: repoRoot,
        isDev: false,
      })
    ).toBe(bundledMainDir);
  });
});
