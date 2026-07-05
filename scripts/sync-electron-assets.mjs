import { cp, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const extensionSourceDir = path.join(rootDir, 'src', 'main', 'db', 'extensions');
const extensionOutDir = path.join(rootDir, 'out', 'electron', 'db', 'extensions');
const mainOutDir = path.join(rootDir, 'out', 'electron', 'main');
const workerFiles = ['workerWrapper.js', 'ImageSaverWorker.js'];

await mkdir(extensionOutDir, { recursive: true });
await cp(extensionSourceDir, extensionOutDir, { recursive: true });
await mkdir(mainOutDir, { recursive: true });

for (const workerFile of workerFiles) {
  await copyFile(
    path.join(rootDir, 'src', 'main', 'modules', 'ImageParser', workerFile),
    path.join(mainOutDir, workerFile)
  );
}
