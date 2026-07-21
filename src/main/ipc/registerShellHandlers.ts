import { app, dialog, ipcMain, shell } from 'electron';
import { AppWindows } from '../windows/createAppWindows';
import DB from '../db';
import {
  invokeChannels,
  rendererEventChannels,
  sendChannels,
} from '../../shared/contracts/exileDiaryApi';

type RegisterShellHandlersDependencies = {
  windows: AppWindows;
  settings: {
    get: (key: string) => any;
    set: (key: string, value: any) => Promise<unknown>;
  };
  sendToMain: (event: string, data?: any) => void;
  refreshWindows: () => void;
  registerHotkeys: () => void;
  unregisterHotkeys: () => void;
};

export function registerShellHandlers({
  windows,
  settings,
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

  ipcMain.on(sendChannels.setOverlayPosition, async (event, { x, y }) => {
    await settings.set('overlayPosition', { x, y });
  });

  ipcMain.handle(invokeChannels.getOverlayPosition, () => {
    return settings.get('overlayPosition');
  });

  ipcMain.handle(invokeChannels.openFileDialog, async (event, options) => {
    return dialog.showOpenDialog(windows.mainWindow, options);
  });

  ipcMain.handle(invokeChannels.showCharacterDbFile, async () => {
    const activeProfile = settings.get('activeProfile');
    if (activeProfile && activeProfile.characterName && activeProfile.league) {
      const dbPath = DB.getCharacterDbPath(activeProfile.characterName, activeProfile.league);
      if (dbPath) {
        shell.showItemInFolder(dbPath);
      }
      return;
    }
  });
}
