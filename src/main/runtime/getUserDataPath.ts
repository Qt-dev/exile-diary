import path from 'node:path';
import { app } from 'electron';

function readBooleanEnv(name: string) {
  const value = process.env[name];
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return undefined;
}

export function getUserDataPath() {
  const overriddenUserDataPath = process.env.EXILE_DIARY_USER_DATA_PATH;
  if (overriddenUserDataPath) {
    return path.resolve(overriddenUserDataPath);
  }

  if (app?.getPath) {
    try {
      return app.getPath('userData');
    } catch {}
  }

  throw new Error(
    'Exile Diary user data path is unavailable. Set EXILE_DIARY_USER_DATA_PATH when running outside Electron.'
  );
}

export function getIsPackaged() {
  const overriddenIsPackaged = readBooleanEnv('EXILE_DIARY_IS_PACKAGED');
  if (overriddenIsPackaged !== undefined) {
    return overriddenIsPackaged;
  }

  if (typeof app?.isPackaged === 'boolean') {
    return app.isPackaged;
  }

  return false;
}

export function getAppVersion() {
  const overriddenAppVersion = process.env.EXILE_DIARY_APP_VERSION;
  if (overriddenAppVersion) {
    return overriddenAppVersion;
  }

  if (app?.getVersion) {
    try {
      return app.getVersion();
    } catch {}
  }

  return 'dev-sidecar';
}
