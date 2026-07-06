import logger from 'electron-log';
import { RendererStatsUseCaseDependencies } from '../rendererRuntimeDependencies';

export function createRendererStatsUseCases(deps: RendererStatsUseCaseDependencies) {
  return {
    async getAllStats(params?: { league?: string; characterName?: string }) {
      logger.info('Getting all stats for the renderer process');
      const profile = deps.settingsManager.get('activeProfile');
      const league = params?.league ?? profile?.league;
      const characterName = params?.characterName ?? profile?.characterName;
      const stats = await deps.statsManager.getAllStats({ league, characterName });
      stats.divinePrice = await deps.itemPricer.getCurrencyByName('Divine Orb', deps.now(), league);
      return stats;
    },

    async triggerSearch(params: Record<string, any>) {
      logger.info('Triggering search from the renderer process');
      deps.searchManager.search(params);
    },

    async getDivinePrice() {
      logger.info('Getting divine price from the renderer process');
      return deps.itemPricer.getCurrencyByName(
        'Divine Orb',
        deps.now(),
        deps.settingsManager.get('activeProfile')?.league
      );
    },

    async getAllMapNames() {
      logger.info('Getting all map names from the renderer process');
      return deps.statsManager.getAllMapNames();
    },

    async getAllPossibleMods() {
      logger.info('Getting all possible mods from the renderer process');
      return deps.statsManager.getAllPossibleMods();
    },

    async refreshProfitPerHour() {
      deps.statsManager.triggerProfitPerHourAnnouncer();
    },

    async debugFetchRates() {
      logger.info('Fetching rates from the renderer process');
      await deps.rateGetter.update(true);
    },
  };
}
