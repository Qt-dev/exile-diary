const { webFrame, ipcRenderer, shell, BrowserWindow, clipboard } = require('electron');
const childProcess = require('child_process');
const fs = require('fs');

const { appPath, appLocale } = ipcRenderer.sendSync('app-globals', '');

export const electronService = {
  BrowserWindow,
  ipcRenderer,
  webFrame,
  childProcess,
  fs,
  shell,
  appPath,
  appLocale,
  clipboard,
};
