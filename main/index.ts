import { app, BrowserWindow } from 'electron'
import * as path from 'path';
const devUrl = 'http://localhost:3000'
enum SYSTEMS {
  WINDOWS = 'win32',
  LINUX = 'debian',
  MACOS = 'darwin',
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  require('electron-reload')(__dirname, {
    electron: path.join(
      __dirname,
      '..',
      '..',
      'node_modules',
      '.bin',
      'electron' + (process.platform === SYSTEMS.WINDOWS ? '.cmd' : '')
    ),
    forceHardReset: true,
    hardResetMethod: 'exit',
  });

  win.loadURL(devUrl);
}

app.whenReady().then(() => {
  createWindow()
})