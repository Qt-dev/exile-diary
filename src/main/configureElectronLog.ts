import fs from 'fs';
import path from 'path';
import logger from 'electron-log';

export function configureElectronLog(logFileName = 'main.log') {
  if (process.env.EXILE_DIARY_DISABLE_FILE_LOGGING === '1') {
    logger.transports.file.level = false;
    return;
  }

  const userDataPath = process.env.EXILE_DIARY_USER_DATA_PATH;
  if (!userDataPath) {
    return;
  }

  const logDirectory = path.resolve(userDataPath, 'logs');
  fs.mkdirSync(logDirectory, { recursive: true });
  logger.transports.file.resolvePathFn = () => path.join(logDirectory, logFileName);
}
