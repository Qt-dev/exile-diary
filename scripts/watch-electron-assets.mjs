import chokidar from 'chokidar';
import path from 'node:path';
import { syncElectronAssets, workerFiles } from './sync-electron-assets.mjs';

const rootDir = process.cwd();
const imageParserDir = path.join(rootDir, 'src', 'main', 'modules', 'ImageParser');
const extensionDir = path.join(rootDir, 'src', 'main', 'db', 'extensions');
const watchedPaths = [
  path.join(extensionDir, '**', '*'),
  ...workerFiles.map((workerFile) => path.join(imageParserDir, workerFile)),
];

let isSyncRunning = false;
let hasQueuedSync = false;

async function runSync(reason = 'startup') {
  if (isSyncRunning) {
    hasQueuedSync = true;
    return;
  }

  isSyncRunning = true;

  try {
    await syncElectronAssets(rootDir);
    console.log(`[watch-electron-assets] synced (${reason})`);
  } catch (error) {
    console.error('[watch-electron-assets] sync failed', error);
  } finally {
    isSyncRunning = false;

    if (hasQueuedSync) {
      hasQueuedSync = false;
      await runSync('queued');
    }
  }
}

await runSync();

const watcher = chokidar.watch(watchedPaths, {
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 150,
    pollInterval: 50,
  },
});

watcher.on('all', async (eventName, changedPath) => {
  await runSync(`${eventName}:${path.basename(changedPath)}`);
});
