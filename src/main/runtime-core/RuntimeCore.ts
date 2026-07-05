import SettingsManager from '../SettingsManager';
import SearchManager from '../SearchManager';
import StatsManager from '../StatsManager';
import ItemPricer from '../modules/ItemPricer';
import RunParser from '../modules/RunParser';
import ScreenshotWatcher from '../modules/ImageParser/ScreenshotWatcher';
import * as OCRWatcher from '../modules/ImageParser/OCRWatcher';
import KillTracker from '../modules/KillTracker';
import RateGetterV2 from '../modules/RateGetterV2';
import * as ClientTxtWatcher from '../modules/ClientTxtWatcher';
import LogProcessor from '../modules/LogProcessor';
import StashGetter from '../modules/StashGetter';

export function createRuntimeCore() {
  return {
    settings: {
      get: SettingsManager.get.bind(SettingsManager),
      getAll: SettingsManager.getAll.bind(SettingsManager),
      registerListener: SettingsManager.registerListener.bind(SettingsManager),
      waitForSave: SettingsManager.waitForSave.bind(SettingsManager),
    },
    search: {
      registerMessageHandler: SearchManager.registerMessageHandler.bind(SearchManager),
    },
    ocr: {
      emitter: OCRWatcher.emitter,
    },
    screenshots: {
      emitter: ScreenshotWatcher.emitter,
      process: ScreenshotWatcher.process.bind(ScreenshotWatcher),
    },
    runTracking: {
      emitter: RunParser.emitter,
      get latestGeneratedArea() {
        return RunParser.latestGeneratedArea;
      },
      refreshTracking: RunParser.refreshTracking.bind(RunParser),
      setCurrentMapStats: RunParser.setCurrentMapStats.bind(RunParser),
      tryProcess: RunParser.tryProcess.bind(RunParser),
      tryUpdateCurrentArea: RunParser.tryUpdateCurrentArea.bind(RunParser),
    },
    stats: {
      registerProfitPerHourAnnouncer:
        StatsManager.registerProfitPerHourAnnouncer.bind(StatsManager),
      triggerProfitPerHourAnnouncer: StatsManager.triggerProfitPerHourAnnouncer.bind(StatsManager),
    },
    pricing: {
      getCurrencyByName: ItemPricer.getCurrencyByName.bind(ItemPricer),
      updateRates: ItemPricer.updateRates.bind(ItemPricer),
    },
    killTracker: {
      emitter: KillTracker.emitter,
    },
    rates: {
      on: RateGetterV2.on.bind(RateGetterV2),
      removeAllListeners: RateGetterV2.removeAllListeners.bind(RateGetterV2),
    },
    clientLogs: {
      emitter: ClientTxtWatcher.emitter,
    },
    logIngest: {
      emitter: LogProcessor.emitter,
    },
    stash: {
      initialize: StashGetter.initialize.bind(StashGetter),
      getNetWorth: StashGetter.getNetWorth.bind(StashGetter),
      on: StashGetter.on.bind(StashGetter),
      removeAllListeners: StashGetter.removeAllListeners.bind(StashGetter),
    },
  };
}

export type RuntimeCore = ReturnType<typeof createRuntimeCore>;
