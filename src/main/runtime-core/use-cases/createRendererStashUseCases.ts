import logger from 'electron-log';
import { RendererStashUseCaseDependencies } from '../rendererRuntimeDependencies';

function getTrackedStashTabIds(stashTabs: Array<{ id: string }>) {
  return [...new Set(stashTabs.map((stashTab) => stashTab.id))].sort();
}

function markTrackedTabs(stashTabs: any[], trackedTabIds: string[]) {
  return stashTabs.map((stash) => ({
    ...stash,
    tracked: trackedTabIds.includes(stash.id),
    children: stash.children?.map((child) => ({
      ...child,
      tracked: trackedTabIds.includes(child.id),
    })),
  }));
}

export function createRendererStashUseCases(deps: RendererStashUseCaseDependencies) {
  return {
    async getStashTabs() {
      logger.info('Getting all stashes for the renderer process');
      const activeProfile = deps.settingsManager.get('activeProfile');
      if (!activeProfile?.league) {
        return { stashTabs: [], data: {} };
      }

      const trackedStashTabs = deps.settingsManager.get('trackedStashTabs');
      const trackedTabIds = trackedStashTabs?.[activeProfile.league] ?? [];
      const stashTabs = markTrackedTabs(await deps.gggApi.getAllStashTabs(), trackedTabIds);
      const stashData = await deps.stashTabsManager.getStashData();
      return { stashTabs, data: stashData };
    },

    async saveStashTabs(stashTabs: Array<{ id: string }>) {
      logger.info('Saving stash info from the renderer process');
      const activeProfile = deps.settingsManager.get('activeProfile');
      if (!activeProfile?.league) {
        return;
      }

      const allTrackedTabs = deps.settingsManager.get('trackedStashTabs') || {};
      allTrackedTabs[activeProfile.league] = getTrackedStashTabIds(stashTabs);
      await deps.settingsManager.set('trackedStashTabs', allTrackedTabs);
    },

    async saveStashRefreshInterval(interval: number) {
      logger.info('Saving stash refresh interval from the renderer process');
      await deps.settingsManager.set('netWorthCheck', { interval });
      deps.stashGetter.refreshInterval();
    },

    async debugFetchStashTabs() {
      logger.info('Fetching stash tabs from the renderer process');
      await deps.stashTabsManager.refresh();
    },
  };
}
