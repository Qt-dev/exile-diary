import logger from 'electron-log';
import { AppWindows } from './createAppWindows';

export type WindowMessenger = ReturnType<typeof createWindowMessenger>;

export function createWindowMessenger({ mainWindow, overlayWindow }: AppWindows) {
  return {
    sendToMain(event: string, data?: any) {
      if (mainWindow) {
        mainWindow.webContents.send(event, data);
      }
    },
    sendToOverlay(event: string, data?: any) {
      if (overlayWindow.isDestroyed()) {
        logger.error('Overlay window is destroyed, cannot send message');
        return;
      }

      overlayWindow.webContents.send(event, data);
    },
  };
}
