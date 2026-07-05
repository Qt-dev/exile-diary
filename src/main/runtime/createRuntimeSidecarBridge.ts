import { EventEmitter } from 'events';
import SettingsManager from '../SettingsManager';
import ScreenshotWatcher from '../modules/ImageParser/ScreenshotWatcher';
import * as OCRWatcher from '../modules/ImageParser/OCRWatcher';
import * as RuntimeSidecarClient from './RuntimeSidecarClient';

const searchCallbackEmitter = new EventEmitter();

export function createRuntimeSidecarBridge() {
  return {
    settings: {
      get: (key: string) => RuntimeSidecarClient.getSettingsSnapshot()?.[key] ?? SettingsManager.get(key),
      getAll: () => ({
        ...SettingsManager.getAll(),
        ...RuntimeSidecarClient.getSettingsSnapshot(),
      }),
      registerListener: (key: string, listener: (...args: any[]) => void) => {
        RuntimeSidecarClient.settingsEmitter.on(key, listener);
      },
      waitForSave: () => Promise.resolve(),
    },
    search: {
      registerMessageHandler: (listener: (event: string, data: any) => void) => {
        searchCallbackEmitter.removeAllListeners('message');
        searchCallbackEmitter.on('message', ({ event, data }) => listener(event, data));
        RuntimeSidecarClient.searchEmitter.removeAllListeners('message');
        RuntimeSidecarClient.searchEmitter.on('message', (payload: { event: string; data: any }) => {
          searchCallbackEmitter.emit('message', payload);
        });
      },
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
    runTracking: {
      emitter: RuntimeSidecarClient.runTrackingEmitter,
      get latestGeneratedArea() {
        return RuntimeSidecarClient.getLatestGeneratedArea();
      },
      refreshTracking: () => RuntimeSidecarClient.callRuntimeMethod('runTracking.refreshTracking'),
      setCurrentMapStats: (stats: Record<string, any>) =>
        RuntimeSidecarClient.callRuntimeMethod('runTracking.setCurrentMapStats', [stats]),
      tryProcess: (payload: Record<string, any>) =>
        RuntimeSidecarClient.callRuntimeMethod('runTracking.tryProcess', [payload]),
      tryUpdateCurrentArea: () =>
        RuntimeSidecarClient.callRuntimeMethod('runTracking.tryUpdateCurrentArea'),
    },
    stats: {
      registerProfitPerHourAnnouncer: (listener: (...args: any[]) => void) => {
        RuntimeSidecarClient.statsEmitter.removeAllListeners('profit-per-hour');
        RuntimeSidecarClient.statsEmitter.on(
          'profit-per-hour',
          ({ profitPerHour, divinePrice }: { profitPerHour: any; divinePrice: number }) =>
            listener(profitPerHour, divinePrice)
        );
      },
      triggerProfitPerHourAnnouncer: () =>
        RuntimeSidecarClient.callRuntimeMethod('stats.triggerProfitPerHourAnnouncer'),
    },
    pricing: {
      getCurrencyByName: (...args: any[]) =>
        RuntimeSidecarClient.callRuntimeMethod('pricing.getCurrencyByName', args),
      updateRates: () => RuntimeSidecarClient.callRuntimeMethod('pricing.updateRates'),
    },
    inventory: {
      getInventoryDiffs: () => Promise.resolve([]),
      compareInventories: () => Promise.resolve([]),
      getInventory: () => Promise.resolve([]),
    },
    killTracker: {
      emitter: RuntimeSidecarClient.killTrackerEmitter,
    },
    rates: {
      on: (event: string, listener: (...args: any[]) => void) =>
        RuntimeSidecarClient.ratesEmitter.on(event, listener),
      removeAllListeners: () => RuntimeSidecarClient.ratesEmitter.removeAllListeners(),
    },
    clientLogs: {
      emitter: RuntimeSidecarClient.clientLogsEmitter,
    },
    logIngest: {
      emitter: RuntimeSidecarClient.logIngestEmitter,
    },
    stash: {
      initialize: () => undefined,
      getNetWorth: () => RuntimeSidecarClient.callRuntimeMethod('stash.getNetWorth'),
      refresh: () => RuntimeSidecarClient.callRuntimeMethod('stash.refresh'),
      on: (event: string, listener: (...args: any[]) => void) =>
        RuntimeSidecarClient.stashEmitter.on(event, listener),
      removeAllListeners: () => RuntimeSidecarClient.stashEmitter.removeAllListeners(),
    },
    sidecar: {
      emitter: RuntimeSidecarClient.emitter,
      start: RuntimeSidecarClient.start,
      stop: RuntimeSidecarClient.stop,
      refreshHealth: RuntimeSidecarClient.refreshHealth,
      getHealth: RuntimeSidecarClient.getHealth,
    },
  };
}

export type RuntimeSidecarBridge = ReturnType<typeof createRuntimeSidecarBridge>;
