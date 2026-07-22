import path from 'node:path';

type ElectronApp = {
  getPath?: (name: 'userData') => string;
  getVersion?: () => string;
  isPackaged?: boolean;
};

function getElectronApp(): ElectronApp | undefined {
  try {
    return require('electron')?.app;
  } catch {
    return undefined;
  }
}

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

  const app = getElectronApp();
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

  const app = getElectronApp();
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

  const app = getElectronApp();
  if (app?.getVersion) {
    try {
      return app.getVersion();
    } catch {}
  }

  return 'dev-sidecar';
}
