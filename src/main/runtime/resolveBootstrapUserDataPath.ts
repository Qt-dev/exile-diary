import * as path from 'node:path';

const REPO_ROOT_MARKERS = ['/src/main/runtime', '/src/main', '/out/electron/main'];

function normalizePathForMatching(value: string) {
  return value.replace(/\\/g, '/');
}

function normalizeWindowsDrivePrefix(value: string) {
  return value.replace(/^\/([A-Za-z]:\/)/, '$1');
}

export function findRepoRoot(startDir: string) {
  const normalizedStartDir = normalizePathForMatching(path.resolve(startDir));

  for (const marker of REPO_ROOT_MARKERS) {
    const markerIndex = normalizedStartDir.lastIndexOf(marker);
    if (markerIndex === -1) {
      continue;
    }

    return normalizeWindowsDrivePrefix(normalizedStartDir.slice(0, markerIndex));
  }

  return null;
}

type ResolveBootstrapUserDataPathOptions = {
  isDefaultApp: boolean;
  moduleDir: string;
  overriddenUserDataPath?: string;
};

export function resolveBootstrapUserDataPath({
  isDefaultApp,
  moduleDir,
  overriddenUserDataPath,
}: ResolveBootstrapUserDataPathOptions) {
  if (overriddenUserDataPath) {
    return path.resolve(overriddenUserDataPath);
  }

  if (!isDefaultApp) {
    return null;
  }

  const repoRoot = findRepoRoot(moduleDir);
  if (!repoRoot) {
    return null;
  }

  return path.join(repoRoot, '.tmp', 'dev-user-data');
}
