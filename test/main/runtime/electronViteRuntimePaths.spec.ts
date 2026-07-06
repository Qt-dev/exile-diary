import path from 'node:path';
import {
  getBundledDbExtensionsPath,
  getImageParserWorkerBasePath,
  getOcrSidecarEntryPath,
  getPreloadBundlePath,
  getRendererIndexPath,
  getRuntimeSidecarEntryPath,
} from '../../../src/main/runtime/electronViteRuntimePaths';

describe('electron-vite runtime paths', () => {
  const repoRoot = path.resolve('workspace', 'exile-diary');
  const bundledMainDir = path.join(repoRoot, 'out', 'electron', 'main');
  const bundledChunkDir = path.join(bundledMainDir, 'chunks');

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

  it('resolves copied worker files from chunked bundle modules outside dev', () => {
    expect(
      getImageParserWorkerBasePath({
        currentMainDir: bundledChunkDir,
        cwd: repoRoot,
        isDev: false,
      })
    ).toBe(bundledMainDir);
  });

  it('uses the sidecar source entry during dev', () => {
    expect(
      getOcrSidecarEntryPath({
        currentMainDir: bundledMainDir,
        cwd: repoRoot,
        isDev: true,
      })
    ).toContain(path.join('src', 'main', 'modules', 'ImageParser', 'OcrSidecar.ts'));
  });

  it('uses the built sidecar bundle outside dev', () => {
    expect(
      getOcrSidecarEntryPath({
        currentMainDir: bundledMainDir,
        cwd: repoRoot,
        isDev: false,
      })
    ).toContain(path.join('out', 'electron', 'main', 'ocr-sidecar.js'));
  });

  it('uses the built OCR sidecar bundle from chunked modules outside dev', () => {
    expect(
      getOcrSidecarEntryPath({
        currentMainDir: bundledChunkDir,
        cwd: repoRoot,
        isDev: false,
      })
    ).toContain(path.join('out', 'electron', 'main', 'ocr-sidecar.js'));
  });

  it('uses the runtime sidecar source entry during dev', () => {
    expect(
      getRuntimeSidecarEntryPath({
        currentMainDir: bundledMainDir,
        cwd: repoRoot,
        isDev: true,
      })
    ).toContain(path.join('src', 'main', 'runtime', 'RuntimeSidecar.ts'));
  });

  it('uses the built runtime sidecar bundle outside dev', () => {
    expect(
      getRuntimeSidecarEntryPath({
        currentMainDir: bundledMainDir,
        cwd: repoRoot,
        isDev: false,
      })
    ).toContain(path.join('out', 'electron', 'main', 'runtime-sidecar.js'));
  });

  it('uses the built runtime sidecar bundle from chunked modules outside dev', () => {
    expect(
      getRuntimeSidecarEntryPath({
        currentMainDir: bundledChunkDir,
        cwd: repoRoot,
        isDev: false,
      })
    ).toContain(path.join('out', 'electron', 'main', 'runtime-sidecar.js'));
  });
});
