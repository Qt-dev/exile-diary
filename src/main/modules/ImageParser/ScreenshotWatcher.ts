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

type ScreenshotSettingsSource = {
  get: (key: string) => any;
  getAll: () => Record<string, any>;
  set: (key: string, value: any) => Promise<unknown>;
  registerListener: (key: string, listener: (value: any) => void) => void;
};

let settingsSource: ScreenshotSettingsSource = SettingsManager;

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
  settingsSource.registerListener('screenshots', applyScreenshotSettings);
}

function applyScreenshotSettings(value: any) {
  unregisterWatcher();
  const { allowFolderWatch, screenshotDir } = value ?? {};

  if (
    allowFolderWatch &&
    screenshotDir &&
    screenshotDir !== 'disabled' &&
    screenshotDir.length > 0
  ) {
    registerWatcher(screenshotDir);
  } else {
    logger.info('Screenshot directory is disabled');
  }
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
  const settings = settingsSource.getAll();
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

function start(source: ScreenshotSettingsSource = SettingsManager) {
  settingsSource = source;
  unregisterWatcher();
  registerListener();

  const settings = settingsSource.getAll();
  let screenshotSettings = settings.screenshots;
  if (!settings.screenshots) {
    const oldDir = settings.screenshotDir;
    screenshotSettings = {
      allowCustomShortcut: true,
      allowFolderWatch: false,
      screenshotDir: oldDir ?? 'disabled',
    };
    void settingsSource.set('screenshots', screenshotSettings);
  }

  applyScreenshotSettings(screenshotSettings ?? settingsSource.get('screenshots'));
}

export default {
  start,
  emitter,
  process: processScreenshot,
};
