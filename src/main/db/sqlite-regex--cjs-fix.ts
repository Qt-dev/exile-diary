// Taken from sqlite-regex package, which is not compatible with CJS
// Todo: Switch that back to the package once EDR is updated to support ESM dependencies
import { join, resolve } from 'node:path';
import { app } from 'electron';
import { arch, platform } from 'node:process';
import { statSync } from 'node:fs';
import { getBundledDbExtensionsPath } from '../runtime/electronViteRuntimePaths';

const supportedPlatforms = [
  ['darwin', 'x64'],
  ['darwin', 'arm64'],
  ['win32', 'x64'],
  ['linux', 'x64'],
];

function validPlatform(platform, arch) {
  return supportedPlatforms.find(([p, a]) => platform === p && arch === a) !== null;
}
function extensionSuffix(platform) {
  if (platform === 'win32') return 'dll';
  if (platform === 'darwin') return 'dylib';
  return 'so';
}

export function getLoadablePath() {
  if (!validPlatform(platform, arch)) {
    throw new Error(
      `Unsupported platform for sqlite-regex, on a ${platform}-${arch} machine, but not in supported platforms (${supportedPlatforms
        .map(([p, a]) => `${p}-${a}`)
        .join(',')}). Consult the sqlite-regex NPM package README for details. `
    );
  }
  const extensionFileName = `regexp.${extensionSuffix(platform)}`;
  const candidatePaths = app.isPackaged
    ? [join(process.resourcesPath, 'db', 'extensions', extensionFileName)]
    : [
        join(process.cwd(), 'src', 'main', 'db', 'extensions', extensionFileName),
        join(getBundledDbExtensionsPath(resolve(__dirname, '..')), extensionFileName),
      ];

  const loadablePath = candidatePaths.find((candidatePath) =>
    statSync(candidatePath, { throwIfNoEntry: false })
  );

  if (!loadablePath) {
    throw new Error(
      `Loadble extension for regex not found. Tried: ${candidatePaths.join(
        ', '
      )}. Consult the sqlite-regex NPM package README for details.}`
    );
  }

  return loadablePath;
}
