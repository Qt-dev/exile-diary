import fs from 'fs';
import path from 'path';
import logger from 'electron-log';
import { getUserDataPath } from './runtime/getUserDataPath';

export function configureElectronLog(logFileName = 'main.log') {
  if (process.env.EXILE_DIARY_DISABLE_FILE_LOGGING === '1') {
    logger.transports.file.level = false;
    return;
  }

  const userDataPath = getUserDataPath();

  const logDirectory = path.resolve(userDataPath, 'logs');
  fs.mkdirSync(logDirectory, { recursive: true });
  logger.transports.file.level = logger.transports.file.level || 'info';
  logger.transports.file.resolvePathFn = () => path.join(logDirectory, logFileName);
}
