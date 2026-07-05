import fs from 'node:fs/promises';
import path from 'node:path';
import dayjs from 'dayjs';
import chokidar, { type FSWatcher } from 'chokidar';
import Logger from 'electron-log';
import EventEmitter from 'events';
import SettingsManager from '../../SettingsManager';
import * as OCRWatcher from './OCRWatcher';

const logger = Logger.scope('main-screenshot-watcher');
const ProcessingTimeout = 15000;

let watcher: FSWatcher | null = null;
const emitter = new EventEmitter();

function registerWatcher(screenshotDir: string) {
  logger.info('Watching ' + screenshotDir);
  watcher = chokidar.watch(screenshotDir, {
    usePolling: true,
    awaitWriteFinish: true,
    ignoreInitial: true,
  });
  watcher.on('add', async (filePath) => {
    logger.info('Processing new screenshot: ' + filePath);
    const stats = await fs.stat(filePath);
    emitter.emit('OCRStart', stats);
    await processScreenshot(await fs.readFile(filePath), { trigger: 'manual', captureMs: 0 });
  });
}

function unregisterWatcher() {
  if (watcher) {
    try {
      watcher.close();
      watcher = null;
    } catch (error: any) {
      const message =
        'Error closing screenshot watcher' + (error.message ? `: ${error.message}` : '');
      logger.error(message);
    }
  }
}

function registerListener() {
  SettingsManager.registerListener('screenshots', (value) => {
    const { allowFolderWatch, screenshotDir } = value;

    if (allowFolderWatch && screenshotDir) {
      registerWatcher(screenshotDir);
    } else {
      unregisterWatcher();
    }
  });
}

async function processScreenshot(
  screenshot: string | Buffer,
  {
    trigger = 'manual',
    captureMs = 0,
  }: {
    trigger?: 'manual' | 'map-enter' | 'retry';
    captureMs?: number;
  } = {}
) {
  const settings = SettingsManager.getAll();
  const jobId = dayjs().format('YYYYMMDDHHmmss');
  const timeout = setTimeout(() => {
    logger.error('Screenshot processing timed out');
    emitter.emit('screenshot:timeout');
  }, ProcessingTimeout);

  try {
    await OCRWatcher.scanScreenshotBuffer(
      screenshot,
      {
        jobId,
        profileId: settings.activeProfile?.characterName ?? 'unknown-profile',
        league: settings.activeProfile?.league ?? 'unknown-league',
        trigger,
        debugArtifacts: Boolean(process.env.ELECTRON_RENDERER_URL || settings.forceDebugMode),
        captureRegionHint: {
          side: 'right',
          windowTitlePattern: 'Path of Exile',
        },
      },
      { captureMs }
    );
  } finally {
    clearTimeout(timeout);
  }
}

function start() {
  unregisterWatcher();
  registerListener();

  const settings = SettingsManager.getAll();
  if (!settings.screenshots) {
    const oldDir = settings.screenshotDir;
    SettingsManager.set('screenshots', {
      allowCustomShortcut: true,
      allowFolderWatch: false,
      screenshotDir: oldDir ?? 'disabled',
    });
  }

  const screenshotSettings = SettingsManager.get('screenshots');
  if (
    screenshotSettings.allowFolderWatch &&
    screenshotSettings.screenshotDir &&
    screenshotSettings.screenshotDir !== 'disabled' &&
    screenshotSettings.screenshotDir.length > 0
  ) {
    registerWatcher(screenshotSettings.screenshotDir);
  } else {
    logger.info('Screenshot directory is disabled');
  }
}

export default {
  start,
  emitter,
  process: processScreenshot,
};
