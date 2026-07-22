const path = require('node:path');
const Logger = require('electron-log');
const dayjs = require('dayjs');
const Piscina = require('piscina');
const { resolve } = require('node:path');
const { createWorker, createScheduler } = require('tesseract.js');
const { matchMapMods } = require('./matchMapMods');
const { getImageParserWorkerBasePath } = require('../../runtime/electronViteRuntimePaths');

const logger = Logger.scope('ocr-scan-service');
const numOfWorkers = 2;

function splitRecognizedLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function getDebugArtifactsRootDir() {
  if (process.env.EXILE_DIARY_USER_DATA_PATH) {
    return path.resolve(process.env.EXILE_DIARY_USER_DATA_PATH);
  }

  try {
    const { app } = require('electron');
    if (app?.isReady?.()) {
      return app.getPath('userData');
    }
  } catch {}

  return path.join(process.cwd(), '.tmp');
}

function getDebugArtifactDir(job) {
  if (!job.debugArtifacts) {
    return undefined;
  }

  return path.join(getDebugArtifactsRootDir(), '.ocr-debug', job.jobId);
}

function getDefaultMapStatsFn() {
  return require('../RunParser').default.getMapStats;
}

function getDefaultSettingsProvider() {
  return () => {
    const SettingsManager = require('../../SettingsManager').default;
    return SettingsManager.getAll();
  };
}

function getDefaultRunRepository() {
  return require('../../db/run').default;
}

function getMapStatsProvider() {
  if (process.env.EXILE_DIARY_OCR_DISABLE_MAP_STATS === '1') {
    return () => ({ iir: 0, iiq: 0, pack_size: 0 });
  }

  return getDefaultMapStatsFn();
}

function createOcrScanService({
  currentMainDir = __dirname,
  cwd = process.cwd(),
  isDev = Boolean(process.env.ELECTRON_RENDERER_URL),
  emitCompletedJob = () => undefined,
  emitError = () => undefined,
  persistMatchedMods: persistMatchedModsOverride,
  getMapStatsFn = getMapStatsProvider(),
  settingsProvider = getDefaultSettingsProvider(),
  tesseractLangPath = process.env.EXILE_DIARY_TESSDATA_PATH ?? process.resourcesPath ?? cwd,
} = {}) {
  const scheduler = createScheduler();
  const workerBasePath = getImageParserWorkerBasePath({
    currentMainDir,
    cwd,
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
        langPath: tesseractLangPath,
        gzip: false,
      });
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

  async function preprocessAndRecognize({ screenshotBuffer, debugArtifactDir }) {
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
        durationMs: Number(
          (firstOcr.durationMs + fallbackOcr.durationMs + rawOcr.durationMs).toFixed(4)
        ),
      },
      usedFallback: 'raw-image',
    };
  }

  async function defaultPersistMatchedMods(matchedMods) {
    if (matchedMods.length === 0) {
      return null;
    }

    const DB = getDefaultRunRepository();
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

  const persistMatchedMods =
    persistMatchedModsOverride ??
    (process.env.EXILE_DIARY_OCR_DISABLE_PERSIST === '1'
      ? async () => null
      : defaultPersistMatchedMods);

  async function scanScreenshotBuffer(screenshotBuffer, job, { captureMs = 0 } = {}) {
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

      const completedPayload = {
        result,
        mapMods: result.matchedMods.map((match) => match.mod),
        mapStats: getMapStatsFn(result.matchedMods.map((match) => match.mod)),
      };

      emitCompletedJob(completedPayload);

      if (result.status === 'error') {
        emitError();
      }

      return result;
    } catch (error) {
      logger.error('Error while scanning map mods', error);
      emitError();
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

    const settings = settingsProvider();
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

  async function dispose() {
    try {
      await startupPromise;
    } catch {}

    await Promise.allSettled([scheduler.terminate(), piscina.destroy()]);
  }

  return {
    start: ensureStarted,
    scheduler,
    processImageBuffer,
    scanScreenshotBuffer,
    dispose,
  };
}

module.exports = {
  createOcrScanService,
};
