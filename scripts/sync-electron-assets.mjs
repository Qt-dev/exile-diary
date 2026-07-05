import { cp, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const workerFiles = ['workerWrapper.js', 'ImageSaverWorker.js'];

export async function syncElectronAssets(rootDir = process.cwd()) {
  const extensionSourceDir = path.join(rootDir, 'src', 'main', 'db', 'extensions');
  const extensionOutDir = path.join(rootDir, 'out', 'electron', 'db', 'extensions');
  const mainOutDir = path.join(rootDir, 'out', 'electron', 'main');

  await mkdir(extensionOutDir, { recursive: true });
  await cp(extensionSourceDir, extensionOutDir, { recursive: true });
  await mkdir(mainOutDir, { recursive: true });

  for (const workerFile of workerFiles) {
    await copyFile(
      path.join(rootDir, 'src', 'main', 'modules', 'ImageParser', workerFile),
      path.join(mainOutDir, workerFile)
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await syncElectronAssets();
}
