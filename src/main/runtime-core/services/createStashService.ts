import StashGetter from '../../modules/StashGetter';
import StashTabsManager from '../../StashTabsManager';

export function createStashService(
  stashGetter = StashGetter,
  stashTabsManager = StashTabsManager
) {
  return {
    initialize: stashGetter.initialize.bind(stashGetter),
    getNetWorth: stashGetter.getNetWorth.bind(stashGetter),
    refresh: stashTabsManager.refresh.bind(stashTabsManager),
    on: stashGetter.on.bind(stashGetter),
    removeAllListeners: stashGetter.removeAllListeners.bind(stashGetter),
  };
}
