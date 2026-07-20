import fs from 'fs';
import path from 'path';
import logger from 'electron-log';
import { ipcMain } from 'electron';
import { RendererLogPayload, sendChannels } from '../shared/contracts/exileDiaryApi';
import { getUserDataPath } from './runtime/getUserDataPath';

const maxFieldLength = 20000;

function truncate(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value.length > maxFieldLength ? `${value.slice(0, maxFieldLength)}... [truncated]` : value;
}

function getRendererLogPath() {
  const logDirectory = path.resolve(getUserDataPath(), 'logs');
  fs.mkdirSync(logDirectory, { recursive: true });
  return path.join(logDirectory, 'renderer.log');
}

export function writeRendererClientLog(payload: RendererLogPayload) {
  if (process.env.EXILE_DIARY_DISABLE_FILE_LOGGING === '1') {
    return;
  }

  try {
    const entry = {
      timestamp: payload.timestamp ?? new Date().toISOString(),
      level: payload.level,
      source: payload.source ?? 'console',
      scope: payload.scope,
      message: truncate(String(payload.message ?? '')),
      stack: truncate(payload.stack),
    };

    fs.appendFileSync(getRendererLogPath(), `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (error) {
    logger.warn('Failed to write renderer log entry', error);
  }
}

export function registerRendererClientLogHandler() {
  ipcMain.on(sendChannels.rendererLog, (_event, payload: RendererLogPayload) => {
    writeRendererClientLog(payload);
  });
}
