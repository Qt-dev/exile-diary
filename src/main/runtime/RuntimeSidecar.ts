import dayjs from 'dayjs';
import logger from 'electron-log';
import SettingsManager from '../SettingsManager';
import League from '../db/repositories/league';
import ItemDB from '../db/repositories/items';
import RendererLogger from '../RendererLogger';
import IgnoreManager from '../../helpers/ignoreManager';
import RateGetterV2 from '../modules/RateGetterV2';
import * as ClientTxtWatcher from '../modules/ClientTxtWatcher';
import SearchManager from '../SearchManager';
import StatsManager from '../StatsManager';
import {
  createDefaultRendererRuntimeDependencies,
  type RendererRuntimeDependencies,
} from '../runtime-core/rendererRuntimeDependencies';
import { createRendererRuntimeService } from '../runtime-core/RendererRuntimeService';
import { createRuntimeCore } from '../runtime-core/RuntimeCore';
import {
  runtimeMethodKeys,
  runtimeRendererMethodKeys,
  runtimeSidecarEventNames,
  type RuntimeMethodKey,
  type RuntimeRendererMethodKey,
  type RuntimeSidecarEvent,
  type RuntimeSidecarReadyMessage,
  type RuntimeSidecarRequest,
  type RuntimeSidecarResponse,
} from '../../shared/contracts/runtimeSidecar';

const sidecarLogger = logger.scope('runtime-sidecar');
const startedAt = new Date().toISOString();
const benchmarkMode = process.env.EXILE_DIARY_BENCHMARK_MODE as string | undefined;

const runtimeCore = createRuntimeCore();

let runtimeStarted = false;

function sendMessage(
  message: RuntimeSidecarReadyMessage | RuntimeSidecarResponse | RuntimeSidecarEvent
) {
  if (typeof process.send === 'function') {
    process.send(message);
  }
}

function sendEvent(eventName: RuntimeSidecarEvent['eventName'], payload?: unknown) {
  sendMessage({
    type: 'event',
    eventName,
    payload,
  });
}

function createErrorPayload(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

function createRendererRuntimeDeps(): RendererRuntimeDependencies {
  const defaults = createDefaultRendererRuntimeDependencies();

  return {
    ...defaults,
    rendererLogger: {
      log: (payload) => {
        sendEvent(runtimeSidecarEventNames.rendererLog, payload);
      },
    },
  };
}

const rendererRuntime = createRendererRuntimeService(createRendererRuntimeDeps());

const rendererMethodHandlers = runtimeRendererMethodKeys.reduce((handlers, method) => {
  handlers[method] = (...args: any[]) => (rendererRuntime[method] as any)(...args);
  return handlers;
}, {} as Record<RuntimeRendererMethodKey, (...args: any[]) => Promise<unknown>>);

const runtimeMethodHandlers: Record<RuntimeMethodKey, (...args: any[]) => Promise<unknown>> = {
  'runTracking.refreshTracking': async () => runtimeCore.runTracking.refreshTracking(),
  'runTracking.setCurrentMapStats': async (stats) =>
    runtimeCore.runTracking.setCurrentMapStats(stats),
  'runTracking.tryProcess': async (payload) => runtimeCore.runTracking.tryProcess(payload),
  'runTracking.tryUpdateCurrentArea': async () => runtimeCore.runTracking.tryUpdateCurrentArea(),
  'runTracking.getLatestGeneratedArea': async () => runtimeCore.runTracking.latestGeneratedArea,
  'pricing.getCurrencyByName': async (...args) =>
    runtimeCore.pricing.getCurrencyByName(...(args as [string, string?, string?])),
  'pricing.updateRates': async () => runtimeCore.pricing.updateRates(),
  'stats.triggerProfitPerHourAnnouncer': async () =>
    runtimeCore.stats.triggerProfitPerHourAnnouncer(),
  'stash.getNetWorth': async () => runtimeCore.stash.getNetWorth(),
  'stash.refresh': async () => runtimeCore.stash.refresh(),
};

async function initializeRuntimeState() {
  await SettingsManager.initialize();

  if (!SettingsManager.get('username')) {
    sidecarLogger.error('No account name set. Please set your account name in the settings.');
    return;
  }

  const character = await SettingsManager.getCharacter();
  try {
    await SettingsManager.initializeDB(character.name);
    await League.addLeague(character.league);
    sidecarLogger.info(
      `Runtime DB initialized. Character: ${character.name}, League: ${character.league}`
    );
  } catch (error) {
    sidecarLogger.error(
      `Could not set runtime DB up. (Current Account: ${SettingsManager.get('username')})`
    );
    sidecarLogger.error(error);
  }

  IgnoreManager.initialize(sidecarLogger, () => {
    sidecarLogger.debug('Runtime ignore settings updated');
  });
}

function registerRuntimeForwarders() {
  SearchManager.registerMessageHandler((event, data) => {
    sendEvent(runtimeSidecarEventNames.searchMessage, { event, data });
  });

  runtimeCore.stats.registerProfitPerHourAnnouncer((profitPerHour, divinePrice) => {
    sendEvent(runtimeSidecarEventNames.profitPerHourUpdated, {
      profitPerHour,
      divinePrice,
    });
  });

  runtimeCore.runTracking.emitter.removeAllListeners();
  runtimeCore.runTracking.emitter.on('run-parser:latest-area-updated', (area) => {
    sendEvent(runtimeSidecarEventNames.runLatestAreaUpdated, area);
  });
  runtimeCore.runTracking.emitter.on('run-parser:run-processed', (run) => {
    sendEvent(runtimeSidecarEventNames.runProcessed, run);
  });

  runtimeCore.killTracker.emitter.removeAllListeners();
  runtimeCore.killTracker.emitter.on('incubatorsUpdated', (incubators) => {
    sendEvent(runtimeSidecarEventNames.incubatorsUpdated, incubators);
  });
  runtimeCore.killTracker.emitter.on('incubatorsMissing', (equipments) => {
    sendEvent(runtimeSidecarEventNames.incubatorsMissing, equipments);
  });

  runtimeCore.rates.removeAllListeners();
  runtimeCore.rates.on('gettingPrices', () => {
    sendEvent(runtimeSidecarEventNames.ratesGettingPrices);
  });
  runtimeCore.rates.on('doneGettingPrices', () => {
    sendEvent(runtimeSidecarEventNames.ratesDoneGettingPrices);
  });
  runtimeCore.rates.on('gettingPricesFailed', () => {
    sendEvent(runtimeSidecarEventNames.ratesGettingPricesFailed);
  });

  runtimeCore.clientLogs.emitter.removeAllListeners();
  runtimeCore.clientLogs.emitter.on('clientTxtFileError', (clientPath) => {
    sendEvent(runtimeSidecarEventNames.clientTxtFileError, clientPath);
  });
  runtimeCore.clientLogs.emitter.on('clientTxtNotUpdated', (clientPath) => {
    sendEvent(runtimeSidecarEventNames.clientTxtNotUpdated, clientPath);
  });

  runtimeCore.logIngest.emitter.removeAllListeners();
  runtimeCore.logIngest.emitter.on('client-logs:error:local-chat-disabled', () => {
    sendEvent(runtimeSidecarEventNames.localChatDisabled);
  });
  runtimeCore.logIngest.emitter.on('client-logs:generated-run', (payload) => {
    sendEvent(runtimeSidecarEventNames.generatedRun, payload);
  });
  runtimeCore.logIngest.emitter.on('client-logs:entered-map', (payload) => {
    sendEvent(runtimeSidecarEventNames.enteredMap, payload);
  });

  runtimeCore.stash.removeAllListeners();
  runtimeCore.stash.on('stashTabs:updated:full', (data) => {
    sendEvent(runtimeSidecarEventNames.stashTabsUpdatedFull, data);
  });
  runtimeCore.stash.on('netWorthUpdated', (data) => {
    sendEvent(runtimeSidecarEventNames.netWorthUpdated, data);
  });

  const trackedSettingKeys = [
    'filters',
    'overlayPersistenceEnabled',
    'activeProfile',
    'forceDebugMode',
    'logToUI',
    'runParseScreenshotEnabled',
    'screenshots',
    'runParseShortcut',
    'screenshotShortcut',
    'overlayToggleShortcut',
    'overlayMovementShortcut',
    'overlayEnabled',
  ] as const;

  for (const key of trackedSettingKeys) {
    SettingsManager.unregisterListener(key);
    SettingsManager.registerListener(key, (value, oldValue) => {
      sendEvent(runtimeSidecarEventNames.settingsChanged, {
        key,
        value,
        oldValue,
      });
    });
  }
}

async function startBackgroundRuntime() {
  if (runtimeStarted || benchmarkMode) {
    return;
  }

  const activeProfile = SettingsManager.get('activeProfile');
  if (!activeProfile?.valid) {
    sidecarLogger.info('Runtime background services not started because no active profile is set');
    return;
  }

  runtimeStarted = true;
  sidecarLogger.info('Starting runtime sidecar background services');

  RateGetterV2.initialize({
    postUpdateCallback: async () => {
      sendEvent(runtimeSidecarEventNames.rendererLog, {
        messages: [{ text: "Today's prices have been updated" }],
      });
      const itemsValues = await ItemDB.getAllItemsValues();
      if (!itemsValues) {
        sidecarLogger.warn('Unable to get item values - database may not be initialized');
        return;
      }

      const prices = itemsValues.reduce((aggregations, { id, value }) => {
        aggregations[id] = value;
        return aggregations;
      }, {} as Record<string, number>);

      sendEvent(runtimeSidecarEventNames.pricesUpdated, { prices });
    },
  });

  ClientTxtWatcher.start();
  runtimeCore.stash.initialize();
  sendEvent(runtimeSidecarEventNames.runtimeStarted, {
    activeProfile,
    startedAt: dayjs().toISOString(),
  });
}

async function handleRequest(message: RuntimeSidecarRequest) {
  switch (message.command) {
    case 'health-check':
      return {
        status: 'ready',
        pid: process.pid,
        startedAt,
        uptimeSeconds: Number(process.uptime().toFixed(3)),
        runtimeStarted,
      };
    case 'shutdown':
      return {
        status: 'stopped',
      };
    case 'renderer-method':
      return rendererMethodHandlers[message.payload.method](...message.payload.args);
    case 'runtime-method':
      return runtimeMethodHandlers[message.payload.method](...message.payload.args);
  }
}

async function shutdown(exitCode = 0) {
  process.exit(exitCode);
}

process.on('message', async (message: RuntimeSidecarRequest) => {
  if (!message || message.type !== 'request') {
    return;
  }

  try {
    const result = await handleRequest(message);
    sendMessage({
      type: 'response',
      requestId: message.requestId,
      ok: true,
      result,
    });

    if (message.command === 'shutdown') {
      await shutdown(0);
    }
  } catch (error) {
    sidecarLogger.error('Runtime sidecar request failed', error);
    sendMessage({
      type: 'response',
      requestId: message.requestId,
      ok: false,
      error: createErrorPayload(error),
    });
  }
});

process.once('disconnect', async () => {
  await shutdown(0);
});

process.once('SIGTERM', async () => {
  await shutdown(0);
});

process.once('SIGINT', async () => {
  await shutdown(0);
});

initializeRuntimeState()
  .then(async () => {
    registerRuntimeForwarders();
    await startBackgroundRuntime();
    sendMessage({
      type: 'ready',
      pid: process.pid,
      startedAt,
    });
  })
  .catch(async (error) => {
    sidecarLogger.error('Failed to start runtime sidecar', error);
    await shutdown(1);
  });
