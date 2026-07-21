import path from 'node:path';

import {
  findRepoRoot,
  resolveBootstrapUserDataPath,
} from '../../../src/main/runtime/resolveBootstrapUserDataPath';

describe('resolveBootstrapUserDataPath', () => {
  const repoRoot = path.resolve(process.cwd());
  const normalizeForComparison = (value: string | null) =>
    value ? value.replace(/\\/g, '/').replace(/\/+/g, '/') : value;

  it('prefers the explicit bootstrap override', () => {
    expect(
      resolveBootstrapUserDataPath({
        isDefaultApp: true,
        moduleDir: path.join(repoRoot, 'src', 'main'),
        overriddenUserDataPath: '.tmp\\custom-user-data',
      })
    ).toBe(path.resolve('.tmp\\custom-user-data'));
  });

  it('uses a stable repo-local dev userData path for default-app launches', () => {
    expect(
      normalizeForComparison(
        resolveBootstrapUserDataPath({
          isDefaultApp: true,
          moduleDir: path.join(repoRoot, 'src', 'main'),
        })
      )
    ).toBe(normalizeForComparison(path.join(repoRoot, '.tmp', 'dev-user-data')));
  });

  it('does not override userData for packaged-style launches', () => {
    expect(
      resolveBootstrapUserDataPath({
        isDefaultApp: false,
        moduleDir: path.join(repoRoot, 'src', 'main'),
      })
    ).toBeNull();
  });

  it('finds the repo root from nested source directories', () => {
    expect(normalizeForComparison(findRepoRoot(path.join(repoRoot, 'src', 'main', 'runtime')))).toBe(
      normalizeForComparison(repoRoot)
    );
  });
});
