const Tail = require('tail').Tail;
const logger = require('electron-log');
const EventEmitter = require('events');
const dayjs = require('dayjs');
const Utils = require('./Utils').default;
const SettingsManager = require('../SettingsManager').default;
const LogProcessor = require('./LogProcessor').default;
const fs = require('fs').promises;

let tail;
let emitter = new EventEmitter();

let lastInstanceServer = null;
let parsedInstanceServerTwice = false;

// Line Parsing Regular Expressions
const lineParseRegex = /^(?<timestamp>.{19}).*]\s(?<line>.*)$/;



function start() {
  const settings = SettingsManager.getAll();

  if (tail) {
    try {
      tail.unwatch();
    } catch (err) {
      logger.error('Error resetting tail watcher:');
      logger.error(err);
    }
  }

  if (settings.clientTxt) {
    checkValidLogfile(settings.clientTxt);

    const tailOptions = {
      fromBeginning: false,
      follow: true,
      useWatchFile: true,
      fsWatchOptions: {
        persistent: true,
        interval: 500,
      },
    };
    logger.info(`Watching ${settings.clientTxt}`, tailOptions);

    tail = new Tail(`${settings.clientTxt}`, tailOptions);

    tail.on('line', async (line) => {
      // logger.debug(`Client.txt line: ${line}`);
      const lowerCaseLine = line.toLowerCase();
      
      const stringPatterns = {
        end: [
          `] @to ${settings.activeProfile.characterName.toLowerCase()}: end`,
          `] ${settings.activeProfile.characterName.toLowerCase()}: end`,
        ],
        generating: [
          'generating'
        ],
      }

      if (process.platform === 'linux') {
        // Remove carriage return
        // NOTE: PoE run on wine, the client.txt file has Windows carriage return
        //       This cause an error when trying to execute the regexp on the line
        line = JSON.stringify(line).replace(/(\\r\\n|\\n|\\r)/, '');
        line = JSON.parse(line);
      }

      const lineMatch = lineParseRegex.exec(line);
      if (!lineMatch) {
        logger.error(`Failed to parse line: ${line}`);
        return;
      }
      // Extract timestamp and line content from the match
      const { timestamp: originalTimestamp, line: content } = lineMatch.groups;
      const timestamp = dayjs(originalTimestamp, 'YYYY/MM/DD HH:mm:ss').toISOString(); 


      // set afk flag to avoid unnecessary net worth checking
      if (line.includes('] : AFK mode is now ON. Autoreply')) {
        logger.info('Setting AFK mode to ON');
        global.afk = true;
        return;
      } else {
        if (global.afk) {
          logger.info('Setting AFK mode to OFF');
        }
        global.afk = false;
      }

      if (stringPatterns.end.some(pattern => lowerCaseLine.endsWith(pattern))) { // Check for end map signal
        LogProcessor.schedule(async () => {
          LogProcessor.processEnd(timestamp, content);
        });
      } else if (stringPatterns.generating.some(pattern => lowerCaseLine.includes(pattern))) { // Check for area generation
        // 2023/09/22 23:53:40 90163078 1186a0e2 [DEBUG Client 5808] Generating level 83 area "MapWorldsIvoryTemple" with seed 2066513710
        LogProcessor.schedule(async () => {
          LogProcessor.processGeneration(timestamp, content);
        });

      } else if (line.includes('Connecting to instance server at')) { // Check for disabled local chat using the instance server pattern
        LogProcessor.schedule(async () => {
          LogProcessor.processNewInstance(timestamp, content);
        });
      } else {
        LogProcessor.schedule(async () => {
          LogProcessor.processOther(timestamp, content);
        });
      }
    });
    tail.on('error', (error) => {
      logger.error(`Error reading client.txt: ${error}`);
    });
    tail.watch();
  }
}

async function checkValidLogfile(path) {
  let poeRunning = await Utils.poeRunning();

  try {
    const stats = await fs.stat(path);
    let timeSinceLastUpdate = Date.now() - stats.mtime;
    logger.info(`Client.txt last updated: ${stats.mtime}`);
    if (poeRunning && timeSinceLastUpdate > 24 * 60 * 60 * 1000) {
      logger.warn(`Client.txt file is older than 24 hours, please check if PoE is running.`);
      emitter.emit('clientTxtNotUpdated', path);
    }
  } catch (err) {
    logger.error(`Client.txt file not found at ${path}`);
    emitter.emit('clientTxtFileError', path);
    return;
  }
}


module.exports.start = start;
module.exports.emitter = emitter;
module.exports.checkValidLogfile = checkValidLogfile;
