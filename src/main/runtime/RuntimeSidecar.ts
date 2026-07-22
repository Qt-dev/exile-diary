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
  type RuntimeLifecycleSnapshot,
  type RuntimeRendererMethodKey,
  type RuntimeSidecarEvent,
  type RuntimeSidecarReadyMessage,
  type RuntimeSidecarRequest,
  type RuntimeSidecarResponse,
} from '../../shared/contracts/runtimeSidecar';
import { authSessionReadiness } from '../auth/AuthSessionReadiness';
import { syncAuthSessionReadiness } from '../auth/syncAuthSessionReadiness';
import { initializeAndStartBackgroundRuntime } from './initializeAndStartBackgroundRuntime';
import { trackedRuntimeSettingKeys } from './trackedRuntimeSettingKeys';

const sidecarLogger = logger.scope('runtime-sidecar');
const startedAt = new Date().toISOString();
const benchmarkMode = process.env.EXILE_DIARY_BENCHMARK_MODE as string | undefined;

const runtimeCore = createRuntimeCore();

let runtimeStarted = false;
let runtimeStateInitialized = false;
let runtimeStateInitializationPromise: Promise<void> | null = null;
let runtimeLifecycle: RuntimeLifecycleSnapshot = {
  state: 'booting',
  generation: 0,
};

function isProfileIdentityChange(nextProfile: any) {
  const currentProfile = SettingsManager.get('activeProfile');
  return (
    currentProfile?.characterName !== nextProfile?.characterName ||
    currentProfile?.league !== nextProfile?.league
  );
}

function setRuntimeLifecycle(
  state: RuntimeLifecycleSnapshot['state'],
  partial: Partial<Omit<RuntimeLifecycleSnapshot, 'state'>> = {}
) {
  runtimeLifecycle = {
    ...runtimeLifecycle,
    ...partial,
    state,
  };
  sendEvent(runtimeSidecarEventNames.runtimeStateChanged, runtimeLifecycle);
}

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
  'auth.refreshSession': async () => {
    await SettingsManager.reload();
    await syncAuthSessionReadiness();
    await initializeAndStartBackgroundRuntime(
      ensureRuntimeStateInitialized,
      startBackgroundRuntime
    );
  },
  'settings.set': async (key, value) => {
    const isProfileTransition = key === 'activeProfile' && isProfileIdentityChange(value);
    if (isProfileTransition) setRuntimeLifecycle('switching');
    try {
      return await SettingsManager.set(key, value);
    } catch (error) {
      if (isProfileTransition) setRuntimeLifecycle(runtimeStateInitialized ? 'ready' : 'failed');
      throw error;
    }
  },
  'settings.waitForSave': async () => SettingsManager.waitForSave(),
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
  await syncAuthSessionReadiness();
  await ensureRuntimeStateInitialized();
  authSessionReadiness.subscribe((state) => {
    if (state.profileReady && !runtimeStateInitialized) {
      void initializeAndStartBackgroundRuntime(
        ensureRuntimeStateInitialized,
        startBackgroundRuntime
      ).catch((error) => {
        sidecarLogger.error('Failed to start runtime after profile became ready', error);
      });
    }
  });
}

async function ensureRuntimeStateInitialized() {
  if (runtimeStateInitialized) {
    return;
  }

  if (runtimeStateInitializationPromise) return runtimeStateInitializationPromise;

  if (!authSessionReadiness.getState().profileReady) {
    sidecarLogger.info(
      'Runtime DB initialization is waiting for an authenticated session with an active profile'
    );
    setRuntimeLifecycle(
      authSessionReadiness.getState().accountReady ? 'needs-profile' : 'needs-auth'
    );
    return;
  }

  if (!SettingsManager.get('username')) {
    sidecarLogger.info('Runtime DB initialization is waiting for an authenticated account name');
    setRuntimeLifecycle('needs-auth');
    return;
  }

  runtimeStateInitializationPromise = (async () => {
    const character = await SettingsManager.getCharacter();
    if (!character?.name || !character?.league) {
      setRuntimeLifecycle('needs-profile');
      throw new Error('Runtime DB initialization requires a valid active profile');
    }

    setRuntimeLifecycle('preparing', {
      generation: runtimeLifecycle.generation + 1,
      profile: { characterName: character.name, league: character.league },
      error: undefined,
    });

    try {
      await SettingsManager.initializeDB({
        characterName: character.name,
        league: character.league,
        valid: true,
      });
      await League.addLeague(character.league);
      sidecarLogger.info(
        `Runtime DB initialized. Character: ${character.name}, League: ${character.league}`
      );

      IgnoreManager.initialize(sidecarLogger, () => {
        sidecarLogger.debug('Runtime ignore settings updated');
      });
      runtimeStateInitialized = true;
      setRuntimeLifecycle('ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRuntimeLifecycle('failed', { error: message });
      sidecarLogger.error(
        `Could not set runtime DB up. (Current Account: ${SettingsManager.get('username')})`
      );
      sidecarLogger.error(error);
      throw error;
    }
  })();

  try {
    await runtimeStateInitializationPromise;
  } finally {
    runtimeStateInitializationPromise = null;
  }
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

  for (const key of trackedRuntimeSettingKeys) {
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

  if (!runtimeStateInitialized) {
    sidecarLogger.info('Runtime background services are waiting for runtime DB initialization');
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
        runtimeLifecycle,
      };
    case 'shutdown':
      return {
        status: 'stopped',
      };
    case 'renderer-method':
      if (
        runtimeLifecycle.state === 'switching' &&
        message.payload.method !== 'saveSettings'
      ) {
        throw new Error('Runtime profile switch is in progress; retry this request shortly');
      }
      const isProfileTransition =
        message.payload.method === 'saveSettings' &&
        message.payload.args[0]?.activeProfile &&
        isProfileIdentityChange(message.payload.args[0].activeProfile);
      if (isProfileTransition) {
        setRuntimeLifecycle('switching');
      }
      try {
        return await rendererMethodHandlers[message.payload.method](...message.payload.args);
      } catch (error) {
        if (isProfileTransition) {
          setRuntimeLifecycle(runtimeStateInitialized ? 'ready' : 'failed');
        }
        throw error;
      }
    case 'runtime-method': {
      const allowedDuringSwitch = ['settings.set', 'settings.waitForSave'].includes(
        message.payload.method
      );
      if (runtimeLifecycle.state === 'switching' && !allowedDuringSwitch) {
        throw new Error('Runtime profile switch is in progress; retry this request shortly');
      }
      return runtimeMethodHandlers[message.payload.method](...message.payload.args);
    }
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
