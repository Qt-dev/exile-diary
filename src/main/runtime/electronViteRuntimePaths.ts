import path from 'node:path';

type RuntimePathOptions = {
  currentMainDir?: string;
  cwd?: string;
  isDev?: boolean;
};

export function getPreloadBundlePath(currentMainDir = __dirname) {
  return path.resolve(currentMainDir, '..', 'preload', 'index.js');
}

export function getRendererIndexPath(currentMainDir = __dirname) {
  return path.resolve(currentMainDir, '..', '..', 'renderer', 'index.html');
}

export function getBundledDbExtensionsPath(currentMainDir = __dirname) {
  return path.resolve(currentMainDir, '..', 'db', 'extensions');
}

export function getImageParserWorkerBasePath({
  currentMainDir = __dirname,
  cwd = process.cwd(),
  isDev = Boolean(process.env.ELECTRON_RENDERER_URL),
}: RuntimePathOptions = {}) {
  if (isDev) {
    return path.resolve(cwd, 'src', 'main', 'modules', 'ImageParser');
  }

  return currentMainDir;
}
