import { app, dialog, ipcMain, shell } from 'electron';
import { AppWindows } from '../windows/createAppWindows';
import SettingsManager from '../SettingsManager';
import DB from '../db';
import {
  invokeChannels,
  rendererEventChannels,
  sendChannels,
} from '../../shared/contracts/exileDiaryApi';

type RegisterShellHandlersDependencies = {
  windows: AppWindows;
  sendToMain: (event: string, data?: any) => void;
  refreshWindows: () => void;
  registerHotkeys: () => void;
  unregisterHotkeys: () => void;
};

export function registerShellHandlers({
  windows,
  sendToMain,
  refreshWindows,
  registerHotkeys,
  unregisterHotkeys,
}: RegisterShellHandlersDependencies) {
  ipcMain.on(sendChannels.reloadApp, () => {
    app.relaunch();
    app.exit();
  });

  ipcMain.on(sendChannels.notifyFiltersUiUpdated, () => {
    sendToMain(rendererEventChannels.itemsFiltersUpdate);
  });

  ipcMain.on(sendChannels.refreshUi, () => {
    refreshWindows();
  });

  ipcMain.on(sendChannels.disableHotkeys, () => {
    unregisterHotkeys();
  });

  ipcMain.on(sendChannels.enableHotkeys, () => {
    registerHotkeys();
  });

  ipcMain.on(sendChannels.setOverlayClickable, (event, { clickable }) => {
    windows.overlayWindow.setIgnoreMouseEvents(!clickable);
  });

  ipcMain.on(sendChannels.setOverlayPosition, (event, { x, y }) => {
    SettingsManager.set('overlayPosition', { x, y });
  });

  ipcMain.handle(invokeChannels.getOverlayPosition, () => {
    return SettingsManager.get('overlayPosition');
  });

  ipcMain.handle(invokeChannels.openFileDialog, async (event, options) => {
    return dialog.showOpenDialog(windows.mainWindow, options);
  });

  ipcMain.handle(invokeChannels.showCharacterDbFile, async () => {
    const activeProfile = SettingsManager.get('activeProfile');
    if (activeProfile && activeProfile.characterName && activeProfile.league) {
      const dbPath = DB.getCharacterDbPath(activeProfile.characterName, activeProfile.league);
      if (dbPath) {
        shell.showItemInFolder(dbPath);
      }
      return;
    }
  });
}
