import SettingsManager from '../SettingsManager';
import SearchManager from '../SearchManager';
import StatsManager from '../StatsManager';
import ScreenshotWatcher from '../modules/ImageParser/ScreenshotWatcher';
import * as OCRWatcher from '../modules/ImageParser/OCRWatcher';
import KillTracker from '../modules/KillTracker';
import RateGetterV2 from '../modules/RateGetterV2';
import * as ClientTxtWatcher from '../modules/ClientTxtWatcher';
import { createInventoryService } from './services/createInventoryService';
import { createLogIngestService } from './services/createLogIngestService';
import { createPricingService } from './services/createPricingService';
import { createRunTrackingService } from './services/createRunTrackingService';
import { createStashService } from './services/createStashService';

export function createRuntimeCore() {
  const runTracking = createRunTrackingService();
  const pricing = createPricingService();
  const logIngest = createLogIngestService();
  const stash = createStashService();
  const inventory = createInventoryService();

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
      start: OCRWatcher.start,
      stop: OCRWatcher.stop,
      refreshHealth: OCRWatcher.refreshHealth,
      getHealth: OCRWatcher.getHealth,
    },
    screenshots: {
      emitter: ScreenshotWatcher.emitter,
      process: ScreenshotWatcher.process.bind(ScreenshotWatcher),
    },
    runTracking,
    stats: {
      registerProfitPerHourAnnouncer:
        StatsManager.registerProfitPerHourAnnouncer.bind(StatsManager),
      triggerProfitPerHourAnnouncer: StatsManager.triggerProfitPerHourAnnouncer.bind(StatsManager),
    },
    pricing,
    inventory,
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
    logIngest,
    stash,
  };
}

export type RuntimeCore = ReturnType<typeof createRuntimeCore>;
