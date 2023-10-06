const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const logger = require('electron-log');
const EventEmitter = require('events');
const StringMatcher = require('./StringMatcher');
const { getMapStats } = require('./RunParser').default;
const { createWorker, createScheduler } = require('tesseract.js');
const DB = require('../db/run').default;

let watcher;
const emitter = new EventEmitter();
const app = require('electron').app || require('@electron/remote').app;
let mapInfoManager;

const watchPaths = [
  path.join(app.getPath('userData'), '.temp_capture', '*_area.png'),
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
  checkAreaInfoComplete() {
    const { areaInfo, mapMods } = this;
    if (!!areaInfo && !!mapMods) {
      const mapStats = getMapStats(mapMods);
      emitter.emit('areaInfoComplete', { areaInfo, mapMods, mapStats });
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
  for(let i = 0; i < numOfWorkers; i++) {
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

function cleanFailedOCR(e, timestamp) {
  mapInfoManager.cleanup();
  logger.info('Error processing screenshot: ' + e);
  emitter.emit('OCRError');
  if (timestamp) {
    DB.deleteAreaInfo(timestamp);
    DB.deleteMapMods(timestamp);
  }
}

function getAreaInfo(lines) {
  let areaInfo = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!areaInfo.name) {
      const str = StringMatcher.getMap(line);
      if (str.length > 0) {
        areaInfo.name = str;
        continue;
      }
    }
    const levelMatch = line.match(/[Ll]evel\s*:*\s*([1-9][0-9])?/);
    if (levelMatch) {
      areaInfo.level = levelMatch.pop();
      continue;
    }
    const depthMatch = line.match(/[Dd]epth\s*:\s*([1-9][0-9]+)?/);
    if (depthMatch) {
      areaInfo.depth = depthMatch.pop();
      continue;
    }
  }

  if (!areaInfo.depth) {
    areaInfo.depth = null;
  }
  return areaInfo;
}

function getModInfo(lines) {
  const mods = [];
  for (let i = 0; i < lines.length; i++) {
    const mod = StringMatcher.getMod(lines[i]);
    if (mod.length > 0) {
      mods.push(mod);
    }
  }
  return mods;
}

function getAreaNameFromDB(timestamp) {
  return new Promise((resolve, reject) => {
    try {
      const areaName = DB.getAreaName(timestamp);
      resolve(areaName);
    } catch (e) {
      logger.info(`Error getting area name from db: ${e}`);
      reject(e);
    }
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

    if (type === 'area') {
      const area = getAreaInfo(lines);
      const areaName = await getAreaNameFromDB(timestamp);
      if (areaName) {
        logger.info(`Got last entered area from db: ${areaName}`);
        area.name = areaName;
      } else {
        logger.info(`Got last entered area from ocr: ${area.name}`);
      }

      try {
        if(area.name) {
          await DB.insertAreaInfo({
            id: timestamp,
            name: area.name,
            level: area.level,
            depth: area.depth
          });
          mapInfoManager.setAreaInfo(area);
          mapInfoManager.checkAreaInfoComplete();
        } else { 
          throw 'No area name found';
        }
      } catch (e) {
        cleanFailedOCR(err, timestamp);
      }
    } else if (type === 'mods') {
      try {
        const mods = getModInfo(lines);
        let mapModErr = null;

        try {
          await DB.insertMapMods(timestamp, mods);
        } catch (e) {
          mapModErr = e;
        }
        if (mapModErr) {
          cleanFailedOCR(mapModErr, timestamp);
        } else {
          mapInfoManager.setMapMods(mods);
          mapInfoManager.checkAreaInfoComplete();
        }
      } catch (e) {
        cleanFailedOCR(e, timestamp);
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
  processImageBuffer,
};
