import { app } from 'electron';
import logger from 'electron-log';
import {
  runtimeRendererMethodKeys,
  type RuntimeRendererMethodKey,
} from '../../shared/contracts/runtimeSidecar';
import * as RuntimeSidecarClient from '../runtime/RuntimeSidecarClient';

const rendererRuntime = runtimeRendererMethodKeys.reduce((service, method) => {
  service[method] = (...args: any[]) => RuntimeSidecarClient.callRendererMethod(method, args);
  return service;
}, {} as Record<RuntimeRendererMethodKey, (...args: any[]) => Promise<unknown>>);

export const RendererAppService = {
  async getAppGlobals() {
    logger.info('Loading global settings for the renderer process');
    return {
      appPath: __dirname,
      appLocale: app.getLocale(),
      appVersion: app.getVersion(),
    };
  },

  ...(rendererRuntime as any),
};
