import { app } from 'electron';
import logger from 'electron-log';
import {
  runtimeRendererMethodKeys,
  type RuntimeRendererMethodKey,
} from '../../shared/contracts/runtimeSidecar';
import * as RuntimeSidecarClient from '../runtime/RuntimeSidecarClient';
import AuthManager from '../AuthManager';
import GGGAPI from '../GGGAPI';
import { logoutAndSyncRuntime } from '../auth/syncRuntimeAuthSession';

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

  async getOAuthInfo() {
    logger.info('Loading OAuth info directly from the main process AuthManager');
    return AuthManager.getAuthInfo();
  },

  async getCharacters() {
    logger.info('Loading characters directly from the main process GGGAPI');
    return GGGAPI.getAllCharacters();
  },

  async isAuthenticated() {
    logger.info('Checking authentication directly from the main process AuthManager');
    return AuthManager.isAuthenticated(false, {
      activeProfile: RuntimeSidecarClient.getSettingsSnapshot()?.activeProfile,
    });
  },

  async logout() {
    logger.info('Logging out and synchronizing the runtime sidecar session');
    await logoutAndSyncRuntime();
  },
};
