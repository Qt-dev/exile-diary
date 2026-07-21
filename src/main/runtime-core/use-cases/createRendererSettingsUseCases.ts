import logger from 'electron-log';
import { RendererSettingsUseCaseDependencies } from '../rendererRuntimeDependencies';

function pickSettings(allSettings: Record<string, any>, keys: string[]) {
  if (keys.length === 0) {
    return allSettings;
  }

  const selectedSettings: Record<string, any> = {};
  for (const key of keys) {
    selectedSettings[key] = allSettings[key];
  }
  return selectedSettings;
}

export function createRendererSettingsUseCases(deps: RendererSettingsUseCaseDependencies) {
  return {
    async getSettings(keys: string[] = []) {
      logger.info('Loading settings for the renderer process');
      return pickSettings(deps.settingsManager.getAll(), keys);
    },

    async getCharacters() {
      logger.info('Getting all characters for the renderer process');
      return deps.gggApi.getAllCharacters();
    },

    async saveSettings(settings: Record<string, any>) {
      logger.info('Saving settings from the renderer process', settings);
      if (settings.clientTxt) {
        deps.clientTxtWatcher.checkValidLogfile(settings.clientTxt);
      }

      for (const key in settings) {
        await deps.settingsManager.set(key, settings[key]);
      }

      deps.rendererLogger.log({ messages: [{ text: 'Settings saved' }] });
    },

    async getOAuthInfo() {
      logger.info('Getting code info for the renderer process');
      return deps.authManager.getAuthInfo();
    },

    async isAuthenticated() {
      logger.info('Checking if user is authenticated for the renderer process');
      return deps.authManager.isAuthenticated();
    },

    async logout() {
      logger.info('Logging out the user after call from the renderer process');
      await deps.authManager.logout();
    },

    async saveFilterSettings(filters: {
      minimumValue: number;
      filterPatterns: string[];
      perCategory: Record<string, any>;
    }) {
      logger.info('Saving filter settings from the renderer process');
      const { minimumValue, filterPatterns, perCategory } = filters;
      await deps.settingsManager.set('filters', { minimumValue, filterPatterns, perCategory });
      deps.rendererLogger.log({ messages: [{ text: 'Filter settings saved' }] });
    },

    async getOverlayPersistence() {
      logger.info('Fetching Overlay Persistence status for the overlay');
      return deps.settingsManager.get('overlayPersistenceEnabled');
    },
  };
}
