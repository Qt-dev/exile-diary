import { app, BrowserWindow } from 'electron';
import { OVERLAY_WINDOW_OPTS } from 'electron-overlay-window';
import { getPreloadBundlePath } from '../runtime/electronViteRuntimePaths';

export type AppWindows = {
  mainWindow: BrowserWindow;
  overlayWindow: BrowserWindow;
};

export function createAppWindows(): AppWindows {
  const preloadPath = getPreloadBundlePath(__dirname);

  const mainWindow = new BrowserWindow({
    title: `Exile Diary v${app.getVersion()}`,
    backgroundColor: '#000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: preloadPath,
      webSecurity: false,
    },
    show: false,
  });

  const overlayWindow = new BrowserWindow({
    x: 0,
    y: 100,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: preloadPath,
    },
    focusable: false,
    ...OVERLAY_WINDOW_OPTS,
  });

  return {
    mainWindow,
    overlayWindow,
  };
}
