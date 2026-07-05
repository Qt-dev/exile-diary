const path = require('node:path');
const Logger = require('electron-log');
const EventEmitter = require('events');
const dayjs = require('dayjs');
const Piscina = require('piscina');
const { resolve } = require('node:path');
const { app } = require('electron');
const { createWorker, createScheduler } = require('tesseract.js');
const { getMapStats } = require('../RunParser').default;
const SettingsManager = require('../../SettingsManager').default;
const DB = require('../../db/run').default;
const { matchMapMods } = require('./matchMapMods');
const { getImageParserWorkerBasePath } = require('../../runtime/electronViteRuntimePaths');

const logger = Logger.scope('ocr-watcher');
const emitter = new EventEmitter();
const scheduler = createScheduler();
const numOfWorkers = 2;
const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);
const workerBasePath = getImageParserWorkerBasePath({
  currentMainDir: __dirname,
  isDev,
});

const piscina = new Piscina({
  filename: resolve(workerBasePath, 'workerWrapper.js'),
  workerData: { fullpath: resolve(workerBasePath, 'OcrPipelineWorker.js') },
});

let startupPromise = null;

async function setupScheduler() {
  for (let i = 0; i < numOfWorkers; i++) {
    const worker = await createWorker('eng', 1, {
      langPath: process.resourcesPath,
      gzip: false,
    });
    await worker.load();
    await worker.setParameters({
      tessedit_char_whitelist:
        "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:-' ,%+",
    });
    scheduler.addWorker(worker);
  }
}

async function ensureStarted() {
  if (!startupPromise) {
    startupPromise = setupScheduler();
  }

  await startupPromise;
}

function splitRecognizedLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function getDebugArtifactDir(job) {
  if (!job.debugArtifacts) {
    return undefined;
  }

  return path.join(app.getPath('userData'), '.ocr-debug', job.jobId);
}

async function recognizePreprocessedMods(modsImage) {
  const startedAt = performance.now();
  const {
    data: { text },
  } = await scheduler.addJob('recognize', modsImage);

  return {
    rawLines: splitRecognizedLines(text),
    durationMs: Number((performance.now() - startedAt).toFixed(4)),
  };
}

async function recognizeScreenshotBuffer(screenshotBuffer) {
  const startedAt = performance.now();
  const {
    data: { text },
  } = await scheduler.addJob('recognize', screenshotBuffer);

  return {
    rawLines: splitRecognizedLines(text),
    durationMs: Number((performance.now() - startedAt).toFixed(4)),
  };
}

async function preprocessAndRecognize({
  screenshotBuffer,
  debugArtifactDir,
}) {
  const firstPass = await piscina.run(
    {
      screenshotBuffer,
      debugArtifactDir,
      forceFullImage: false,
    },
    { name: 'preprocessMapModsScreenshot' }
  );
  const firstOcr = await recognizePreprocessedMods(firstPass.modsImage);

  if (firstOcr.rawLines.length > 0) {
    return {
      preprocessResult: firstPass,
      ocrResult: firstOcr,
      usedFallback: false,
    };
  }

  const fallbackPass = await piscina.run(
    {
      screenshotBuffer,
      debugArtifactDir,
      forceFullImage: true,
    },
    { name: 'preprocessMapModsScreenshot' }
  );
  const fallbackOcr = await recognizePreprocessedMods(fallbackPass.modsImage);

  if (fallbackOcr.rawLines.length > 0) {
    return {
      preprocessResult: {
        ...fallbackPass,
        timingsMs: {
          preprocess: Number(
            (firstPass.timingsMs.preprocess + fallbackPass.timingsMs.preprocess).toFixed(4)
          ),
        },
      },
      ocrResult: {
        rawLines: fallbackOcr.rawLines,
        durationMs: Number((firstOcr.durationMs + fallbackOcr.durationMs).toFixed(4)),
      },
      usedFallback: 'full-image',
    };
  }

  const rawOcr = await recognizeScreenshotBuffer(screenshotBuffer);

  return {
    preprocessResult: {
      ...fallbackPass,
      timingsMs: {
        preprocess: Number(
          (firstPass.timingsMs.preprocess + fallbackPass.timingsMs.preprocess).toFixed(4)
        ),
      },
    },
    ocrResult: {
      rawLines: rawOcr.rawLines,
      durationMs: Number((firstOcr.durationMs + fallbackOcr.durationMs + rawOcr.durationMs).toFixed(4)),
    },
    usedFallback: 'raw-image',
  };
}

async function persistMatchedMods(matchedMods) {
  if (matchedMods.length === 0) {
    return null;
  }

  const latestRun = await DB.getLatestUncompletedRun();
  if (!latestRun?.id) {
    return null;
  }

  await DB.replaceMapMods(
    latestRun.id,
    matchedMods.map((match) => match.mod)
  );

  return latestRun.id;
}

async function scanScreenshotBuffer(
  screenshotBuffer,
  job,
  { captureMs = 0 } = {}
) {
  await ensureStarted();

  const debugArtifactDir = getDebugArtifactDir(job);

  try {
    const { preprocessResult, ocrResult, usedFallback } = await preprocessAndRecognize({
      screenshotBuffer,
      debugArtifactDir,
    });
    const matchStartedAt = performance.now();
    const matchResult = matchMapMods(ocrResult.rawLines);
    const matchMs = Number((performance.now() - matchStartedAt).toFixed(4));

    await persistMatchedMods(matchResult.matchedMods);

    const result = {
      jobId: job.jobId,
      status: matchResult.status,
      rawLines: matchResult.rawLines,
      normalizedLines: matchResult.normalizedLines,
      matchedMods: matchResult.matchedMods,
      timingsMs: {
        capture: Number(captureMs.toFixed(4)),
        preprocess: preprocessResult.timingsMs.preprocess,
        ocr: ocrResult.durationMs,
        match: matchMs,
      },
      diagnostics: {
        ...matchResult.diagnostics,
        debugArtifactDir,
        usedFallback,
      },
    };

    emitter.emit('ocr:completed-job', {
      result,
      mapMods: result.matchedMods.map((match) => match.mod),
      mapStats: getMapStats(result.matchedMods.map((match) => match.mod)),
    });

    if (result.status === 'error') {
      emitter.emit('OCRError');
    }

    return result;
  } catch (error) {
    logger.error('Error while scanning map mods', error);
    emitter.emit('OCRError');
    return {
      jobId: job.jobId,
      status: 'error',
      rawLines: [],
      normalizedLines: [],
      matchedMods: [],
      timingsMs: {
        capture: Number(captureMs.toFixed(4)),
        preprocess: 0,
        ocr: 0,
        match: 0,
      },
      diagnostics: {
        averageConfidence: 0,
        matchedLineRatio: 0,
        debugArtifactDir,
        error: error?.message ?? String(error),
      },
    };
  }
}

async function processImageBuffer(buffer, timestamp, type) {
  if (type !== 'mods') {
    return null;
  }

  const settings = SettingsManager.getAll();
  return scanScreenshotBuffer(
    buffer,
    {
      jobId: timestamp ?? dayjs().format('YYYYMMDDHHmmss'),
      profileId: settings.activeProfile?.characterName ?? 'unknown-profile',
      league: settings.activeProfile?.league ?? 'unknown-league',
      trigger: 'retry',
      debugArtifacts: Boolean(process.env.ELECTRON_RENDERER_URL || settings.forceDebugMode),
    },
    { captureMs: 0 }
  );
}

async function start() {
  await ensureStarted();
}

module.exports = {
  start,
  emitter,
  scheduler,
  processImageBuffer,
  scanScreenshotBuffer,
  checkJobComplete: () => undefined,
};
