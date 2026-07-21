import { BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import logger from 'electron-log';
import RendererLogger from '../RendererLogger';
import { sendChannels } from '../../shared/contracts/exileDiaryApi';

const autoUpdaterIntervalTime = 1000 * 60 * 60;

type RegisterAutoUpdaterDependencies = {
  overlayWindow: BrowserWindow;
  getIsDownloadingUpdate: () => boolean;
  setIsDownloadingUpdate: (value: boolean) => void;
  setAutoUpdaterInterval: (interval: NodeJS.Timeout) => void;
};

export function registerAutoUpdater({
  overlayWindow,
  getIsDownloadingUpdate,
  setIsDownloadingUpdate,
  setAutoUpdaterInterval,
}: RegisterAutoUpdaterDependencies) {
  ipcMain.on('before-quit-for-update', () => {
    logger.info('Closing the overlay for the update restart');
    overlayWindow.destroy();
  });
  ipcMain.on(sendChannels.downloadUpdate, () => {
    if (getIsDownloadingUpdate()) {
      return;
    }

    setIsDownloadingUpdate(true);
    RendererLogger.log({
      messages: [{ text: 'Downloading update...' }],
    });
    logger.info('Now downloading update');
    autoUpdater.downloadUpdate();
  });
  ipcMain.on(sendChannels.applyUpdate, () => {
    logger.info('Restarting to apply update');
    autoUpdater.quitAndInstall();
  });

  autoUpdater.channel = 'latest';
  autoUpdater.logger = logger;
  autoUpdater.autoDownload = false;
  autoUpdater.on('update-available', (info) => {
    global.updateInfo = info;
    logger.info('Fetched Update Info:', JSON.stringify(info));
    RendererLogger.log({
      messages: [
        {
          text: `An update to version ${info.version} is available, click here to download`,
          linkEvent: sendChannels.downloadUpdate,
        },
      ],
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    RendererLogger.log({
      messages: [
        {
          text: `Update to version ${info.version} has been downloaded, click here to install it now (requires restart)`,
          linkEvent: sendChannels.applyUpdate,
        },
      ],
    });
  });

  autoUpdater
    .checkForUpdates()
    .then((result) => {
      const msg = `Update check done. ${
        !!result ? `Update ${result.updateInfo.releaseName} is available` : 'No Update available'
      }:`;
      logger.info(msg);
      setAutoUpdaterInterval(
        setInterval(() => {
          autoUpdater
            .checkForUpdates()
            .then(() => {
              logger.info(msg);
            })
            .catch((error) => {
              logger.error('Error checking for updates', error);
            });
        }, autoUpdaterIntervalTime)
      );
    })
    .catch((error) => {
      logger.error('Error checking for updates', error);
    });
}
