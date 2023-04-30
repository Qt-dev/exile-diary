import logger from 'electron-log/renderer';
const { webFrame, ipcRenderer, shell, BrowserWindow, clipboard } = require('electron');
const childProcess = require('child_process');
const fs = require('fs');

let appPath = '';
let appLocale = '';
let appVersion = '';

const refreshGlobals = async () => {
  await ipcRenderer.invoke('app-globals').then((params) => {
    appPath = params.appPath;
    appLocale = params.appLocale;
    appVersion = params.appVersion;
  });
};

export const electronService = {
  BrowserWindow,
  ipcRenderer,
  webFrame,
  childProcess,
  fs,
  shell,
  appPath,
  appLocale,
  appVersion,
  clipboard,
  logger: logger.scope('renderer'),
  refreshGlobals,
  getAppVersion: () => appVersion,
};
