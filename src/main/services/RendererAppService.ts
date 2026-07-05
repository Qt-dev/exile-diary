import { app } from 'electron';
import logger from 'electron-log';
import { createRendererRuntimeService } from '../runtime-core/RendererRuntimeService';

const rendererRuntime = createRendererRuntimeService();

export const RendererAppService = {
  async getAppGlobals() {
    logger.info('Loading global settings for the renderer process');
    return {
      appPath: __dirname,
      appLocale: app.getLocale(),
      appVersion: app.getVersion(),
    };
  },

  ...rendererRuntime,
};
