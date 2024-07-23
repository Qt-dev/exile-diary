import logger from 'electron-log/renderer';
const { webFrame, ipcRenderer, shell, BrowserWindow, clipboard } = require('electron');
const childProcess = require('child_process');
const fs = require('fs');

let appPath = '';
let appLocale = '';
let appVersion = '';
const Listeners = {};

const refreshGlobals = async () => {
  await ipcRenderer.invoke('app-globals').then((params) => {
    appPath = params.appPath;
    appLocale = params.appLocale;
    appVersion = params.appVersion;
  });
};

const registerListener = (channel, id, listener) => {
  if (!Listeners[channel]) {
    Listeners[channel] = {};
    startListener(channel);
  }
  Listeners[channel][id] = listener;
};

const startListener = (channel) => {
  logger.debug(`Starting listener for ${channel}`);
  ipcRenderer.on(channel, (event, ...args) => {
    const functions = Object.keys(Listeners[channel]).map((id) => Listeners[channel][id]);
    logger.debug(`Received event ${channel}`);
    functions.forEach((func) => {
      func(event, ...args);
    });
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
  registerListener,
};
