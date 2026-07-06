import path from 'node:path';

type RuntimePathOptions = {
  currentMainDir?: string;
  cwd?: string;
  isDev?: boolean;
};

function getBundledMainRoot(currentMainDir = __dirname) {
  return path.basename(currentMainDir) === 'chunks' ? path.dirname(currentMainDir) : currentMainDir;
}

export function getPreloadBundlePath(currentMainDir = __dirname) {
  return path.resolve(getBundledMainRoot(currentMainDir), '..', 'preload', 'index.js');
}

export function getRendererIndexPath(currentMainDir = __dirname) {
  return path.resolve(getBundledMainRoot(currentMainDir), '..', '..', 'renderer', 'index.html');
}

export function getBundledDbExtensionsPath(currentMainDir = __dirname) {
  return path.resolve(getBundledMainRoot(currentMainDir), '..', 'db', 'extensions');
}

export function getImageParserWorkerBasePath({
  currentMainDir = __dirname,
  cwd = process.cwd(),
  isDev = Boolean(process.env.ELECTRON_RENDERER_URL),
}: RuntimePathOptions = {}) {
  if (isDev) {
    return path.resolve(cwd, 'src', 'main', 'modules', 'ImageParser');
  }

  return getBundledMainRoot(currentMainDir);
}

export function getOcrSidecarEntryPath({
  currentMainDir = __dirname,
  cwd = process.cwd(),
  isDev = Boolean(process.env.ELECTRON_RENDERER_URL),
}: RuntimePathOptions = {}) {
  if (isDev) {
    return path.resolve(cwd, 'src', 'main', 'modules', 'ImageParser', 'OcrSidecar.ts');
  }

  return path.resolve(getBundledMainRoot(currentMainDir), 'ocr-sidecar.js');
}

export function getRuntimeSidecarEntryPath({
  currentMainDir = __dirname,
  cwd = process.cwd(),
  isDev = Boolean(process.env.ELECTRON_RENDERER_URL),
}: RuntimePathOptions = {}) {
  if (isDev) {
    return path.resolve(cwd, 'src', 'main', 'runtime', 'RuntimeSidecar.ts');
  }

  return path.resolve(getBundledMainRoot(currentMainDir), 'runtime-sidecar.js');
}
