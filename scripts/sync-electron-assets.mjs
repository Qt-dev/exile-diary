import { cp, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const workerFiles = ['workerWrapper.js', 'ImageSaverWorker.js', 'OcrPipelineWorker.js'];

async function syncWorkerFiles(rootDir, mainOutDir) {
  await mkdir(mainOutDir, { recursive: true });

  for (const workerFile of workerFiles) {
    await copyFile(
      path.join(rootDir, 'src', 'main', 'modules', 'ImageParser', workerFile),
      path.join(mainOutDir, workerFile)
    );
  }
}

async function syncDbExtensions(rootDir, extensionOutDir) {
  await mkdir(extensionOutDir, { recursive: true });
  await cp(path.join(rootDir, 'src', 'main', 'db', 'extensions'), extensionOutDir, {
    recursive: true,
  });
}

export async function syncElectronAssets(rootDir = process.cwd()) {
  const extensionOutDir = path.join(rootDir, 'out', 'electron', 'db', 'extensions');
  const mainOutDir = path.join(rootDir, 'out', 'electron', 'main');

  await syncWorkerFiles(rootDir, mainOutDir);

  try {
    await syncDbExtensions(rootDir, extensionOutDir);
  } catch (error) {
    console.warn(
      '[sync-electron-assets] Failed to sync DB extensions, continuing with existing copied extensions.',
      error
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await syncElectronAssets();
}
