import { app, BrowserWindow } from 'electron';
import { OVERLAY_WINDOW_OPTS } from 'electron-overlay-window';
import * as path from 'path';

export type AppWindows = {
  mainWindow: BrowserWindow;
  overlayWindow: BrowserWindow;
};

export function createAppWindows(): AppWindows {
  // This module compiles into build/main/windows, while preload.js is emitted into build/main.
  const preloadPath = path.join(__dirname, '..', 'preload.js');

  const mainWindow = new BrowserWindow({
    title: `Exile Diary v${app.getVersion()}`,
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
