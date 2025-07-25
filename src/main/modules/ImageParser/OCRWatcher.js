const path = require('path');
const chokidar = require('chokidar');
const logger = require('electron-log');
const EventEmitter = require('events');
const StringParser = require('../StringParser/StringParser').default;
const { getMapStats } = require('../RunParser').default;
const { createWorker, createScheduler } = require('tesseract.js');
const dayjs = require('dayjs');
let DB = require('../../db/run').default;

let watcher;
const emitter = new EventEmitter();
const app = require('electron').app || require('@electron/remote').app;
let mapInfoManager;

const watchPaths = [
  // path.join(app.getPath('userData'), '.temp_capture', '*_area.png'),
  path.join(app.getPath('userData'), '.temp_capture', '*_mods.png'),
];
const numOfWorkers = 2;

class MapInfoManager {
  constructor() {}
  setAreaInfo(info) {
    this.areaInfo = info;
  }
  setMapMods(mods) {
    this.mapMods = mods;
  }
  cleanup() {
    this.mapMods = null;
    this.areaInfo = null;
  }
  checkJobComplete() {
    const { mapMods } = this;
    if (!!mapMods) {
      const mapStats = getMapStats(mapMods);
      emitter.emit('ocr:completed-job', { mapMods, mapStats });
      this.cleanup();
    }
  }
}

const scheduler = createScheduler();

function test(filename) {
  DB = null;
  processImage(filename);
}

async function setupScheduler() {
  for (let i = 0; i < numOfWorkers; i++) {
    const worker = await createWorker('eng', 1, {
      langPath: process.resourcesPath,
      gzip: false,
      // logger: m => logger.info(m),
    });
    await worker.load();
    await worker.setParameters({
      tessedit_char_whitelist:
        "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:-' ,%+",
    });
    scheduler.addWorker(worker);
  }
}

async function start() {
  mapInfoManager = new MapInfoManager();

  if (watcher) {
    try {
      watcher.close();
      watcher.unwatch(watchPaths);
    } catch (err) {}
  }

  watcher = chokidar.watch(watchPaths, {
    usePolling: true,
    awaitWriteFinish: true,
    ignoreInitial: true,
  });
  watcher.on('add', async (path) => {
    await processImage(path);
  });

  await setupScheduler();
}

async function cleanFailedOCR(e, timestamp) {
  mapInfoManager.cleanup();
  logger.info('Error processing screenshot: ' + e);
  emitter.emit('OCRError');
  const cleanTimestamp = dayjs(timestamp, 'YYYYMMDDHHmmss').toISOString();
  const runId = await DB.getRunIdFromTimestamp(cleanTimestamp);
  if (timestamp && runId) {
    await DB.deleteAreaInfo(runId);
    await DB.deleteMapMods(runId);
  }
}

function getModInfo(lines) {
  const mods = StringParser.GetMods(
    lines.filter((line) => line && line.length > 0).map((line) => line.toLowerCase().trim())
  );
  return mods;
}

async function getAreaNameFromDB(timestamp) {
  return DB.getAreaName(timestamp).catch((e) => {
    logger.error(`Error getting area name from db: ${e}`);
    throw e;
  });
}

async function processImageBuffer(buffer, timestamp, type) {
  logger.info(`Performing OCR on ${type} ...`);

  try {
    const {
      data: { text },
    } = await scheduler.addJob('recognize', buffer);

    // const filename = path.basename(file);
    // const timestamp = filename.substring(0, filename.indexOf('_'));
    const lines = [];
    text.split('\n').forEach((line) => {
      lines.push(line.trim());
      logger.info(line.trim());
    });

    const { id: runId } = await DB.getLatestUncompletedRun();
    // const areaId = await DB.getAreaId();
    logger.info(`Got areaId: ${runId} for timestamp: ${timestamp}`);

    if (type === 'area') {
      logger.debug('Processing area info');
      logger.debug('Will actually do nothing now.');
      // const area = getAreaInfo(lines);
      // try {
      //   const areaName = area.name ?? (await getAreaNameFromDB(timestamp));
      //   logger.info(`Got last entered area: ${areaName}`);
      //   area.name = areaName;
      // } catch (e) {
      //   logger.info(`Got last entered area from ocr: ${area.name}`);
      // }

      // try {
      //   if (area.name) {
      //     await DB.insertAreaInfo({
      //       areaId: runId,
      //       name: area.name,
      //       level: area.level,
      //       depth: area.depth,
      //     });
      //     mapInfoManager.setAreaInfo(area);
      //     mapInfoManager.checkJobComplete();
      //   } else {
      //     throw 'No area name found';
      //   }
      // } catch (err) {
      //   cleanFailedOCR(err, timestamp);
      // }
    } else if (type === 'mods') {
      logger.debug('Processing map mods');
      try {
        const mods = getModInfo(lines);
        let mapModErr = null;

        try {
          await DB.replaceMapMods(runId, mods);
        } catch (e) {
          mapModErr = e;
        }
        if (mapModErr) {
          await cleanFailedOCR(mapModErr, timestamp);
        } else {
          mapInfoManager.setMapMods(mods);
          mapInfoManager.checkJobComplete();
        }
      } catch (e) {
        await cleanFailedOCR(e, timestamp);
      }
    }
  } catch (e) {
    logger.error('Error in fetching OCR text');
    logger.error(e);
  }

  logger.info(`Completed OCR on ${type}.`);
}

module.exports = {
  start,
  test,
  emitter,
  scheduler,
  processImageBuffer,
};
