import { Tail } from 'tail';
import logger from 'electron-log';
import EventEmitter from 'events';
import dayjs from 'dayjs';
import fs from 'fs/promises';
import Utils from './Utils';
import SettingsManager from '../SettingsManager';
import LogProcessor from './LogProcessor';
import { isMapEndSignal } from './mapEnd';

let tail: Tail | undefined;
const emitter = new EventEmitter();

const lineParseRegex = /^(?<timestamp>.{19}).*]\s(?<line>.*)$/;

export function start() {
  const settings = SettingsManager.getAll();

  if (tail) {
    try {
      tail.unwatch();
    } catch (err) {
      logger.error('Error resetting tail watcher:');
      logger.error(err);
    }
  }

  if (!settings.clientTxt) {
    return;
  }

  void checkValidLogfile(settings.clientTxt);

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

  tail.on('line', (line: string) => {
    if (process.platform === 'linux') {
      line = JSON.stringify(line).replace(/(\\r\\n|\\n|\\r)/, '');
      line = JSON.parse(line);
    }

    const lineMatch = lineParseRegex.exec(line);
    if (!lineMatch?.groups) {
      logger.error(`Failed to parse line: ${line}`);
      return;
    }

    const { timestamp: originalTimestamp, line: content } = lineMatch.groups;
    const timestamp = dayjs(originalTimestamp, 'YYYY/MM/DD HH:mm:ss').toISOString();
    const lowerCaseContent = content.toLocaleLowerCase();

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

    let scheduledTask: Promise<unknown>;
    if (isMapEndSignal(content, settings.activeProfile.characterName)) {
      scheduledTask = LogProcessor.schedule(() => LogProcessor.processEnd(timestamp, content));
    } else if (lowerCaseContent.includes('generating')) {
      scheduledTask = LogProcessor.schedule(() =>
        LogProcessor.processGeneration(timestamp, content)
      );
    } else if (line.includes('Connecting to instance server at')) {
      scheduledTask = LogProcessor.schedule(() =>
        LogProcessor.processNewInstance(timestamp, content)
      );
    } else {
      scheduledTask = LogProcessor.schedule(() => LogProcessor.processOther(timestamp, content));
    }
    void scheduledTask.catch((error) => logger.error('Failed to process client log line', error));
  });

  tail.on('error', (error) => {
    logger.error(`Error reading client.txt: ${error}`);
  });
  tail.watch();
}

export async function checkValidLogfile(path: string) {
  const poeRunning = await Utils.poeRunning();

  try {
    const stats = await fs.stat(path);
    const timeSinceLastUpdate = Date.now() - stats.mtime.getTime();
    logger.info(`Client.txt last updated: ${stats.mtime}`);
    if (poeRunning && timeSinceLastUpdate > 24 * 60 * 60 * 1000) {
      logger.warn('Client.txt file is older than 24 hours, please check if PoE is running.');
      emitter.emit('clientTxtNotUpdated', path);
    }
  } catch (err) {
    logger.error(`Client.txt file not found at ${path}`);
    emitter.emit('clientTxtFileError', path);
  }
}

export { emitter };

export default {
  start,
  emitter,
  checkValidLogfile,
};
