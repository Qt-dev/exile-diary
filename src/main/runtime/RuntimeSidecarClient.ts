import { fork, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'events';
import Logger from 'electron-log';
import {
  runtimeSidecarEventNames,
  type RuntimeMethodKey,
  type RuntimeRendererMethodKey,
  type RuntimeSidecarRequest,
} from '../../shared/contracts/runtimeSidecar';
import { getAppVersion, getIsPackaged, getUserDataPath } from './getUserDataPath';
import { getRuntimeSidecarEntryPath } from './electronViteRuntimePaths';

const logger = Logger.scope('runtime-sidecar-client');
export const emitter = new EventEmitter();
export const searchEmitter = new EventEmitter();
export const settingsEmitter = new EventEmitter();
export const runTrackingEmitter = new EventEmitter();
export const killTrackerEmitter = new EventEmitter();
export const ratesEmitter = new EventEmitter();
export const clientLogsEmitter = new EventEmitter();
export const logIngestEmitter = new EventEmitter();
export const stashEmitter = new EventEmitter();
export const pricesEmitter = new EventEmitter();
export const statsEmitter = new EventEmitter();

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);
const StartupTimeoutMs = 20000;
const RequestTimeoutMs = 30000;
const HealthCheckIntervalMs = 15000;
const HealthCheckTimeoutMs = 5000;
const RestartDelayMs = 500;
const MaxConsecutiveHealthCheckFailures = 2;

let sidecarProcess: ChildProcess | null = null;
let startupPromise: Promise<unknown> | null = null;
let startupResolve: ((message: unknown) => void) | null = null;
let startupReject: ((error: Error) => void) | null = null;
let restartTimer: NodeJS.Timeout | null = null;
let healthCheckTimer: NodeJS.Timeout | null = null;
let healthCheckPromise: Promise<unknown> | null = null;
let isStopping = false;
let requestSequence = 0;
let restartCount = 0;
let consecutiveHealthCheckFailures = 0;
let settingsSnapshot: Record<string, any> = {};
let latestGeneratedArea = {
  name: '',
  level: 0,
  depth: 0,
  iir: 0,
  pack_size: 0,
  iiq: 0,
  seed: 0,
  run_id: 0,
};
let latestHealth = {
  status: 'stopped',
  pid: null,
  startedAt: null,
  uptimeSeconds: 0,
  lastHeartbeatAt: null,
  restartCount: 0,
  consecutiveHealthCheckFailures: 0,
  pendingRequestCount: 0,
  lastExitReason: null,
  lastError: null,
};

const pendingRequests = new Map<
  string,
  {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }
>();

function createTimeoutError(action, timeoutMs) {
  return new Error(`Runtime sidecar timed out while waiting for ${action} after ${timeoutMs}ms`);
}

function createSidecarExitError(code, signal) {
  const reason = signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`;
  return new Error(`Runtime sidecar exited unexpectedly (${reason})`);
}

function emitHealthUpdate(partial = {}) {
  latestHealth = {
    ...latestHealth,
    ...partial,
    restartCount,
    consecutiveHealthCheckFailures,
    pendingRequestCount: pendingRequests.size,
  };

  emitter.emit('runtime:health-updated', latestHealth);
  return latestHealth;
}

function clearRestartTimer() {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
}

function clearHealthCheckTimer() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
}

function rejectPendingRequests(error) {
  for (const { reject, timeout } of pendingRequests.values()) {
    clearTimeout(timeout);
    reject(error);
  }
  pendingRequests.clear();
}

function routeEvent(eventName, payload) {
  emitter.emit(eventName, payload);

  switch (eventName) {
    case runtimeSidecarEventNames.searchMessage:
      searchEmitter.emit('message', payload);
      return;
    case runtimeSidecarEventNames.settingsChanged:
      if (payload?.key) {
        settingsSnapshot = {
          ...settingsSnapshot,
          [payload.key]: payload.value,
        };
        settingsEmitter.emit(payload.key, payload.value, payload.oldValue);
      }
      return;
    case runtimeSidecarEventNames.profitPerHourUpdated:
      statsEmitter.emit('profit-per-hour', payload);
      return;
    case runtimeSidecarEventNames.runLatestAreaUpdated:
      latestGeneratedArea = payload;
      runTrackingEmitter.emit('run-parser:latest-area-updated', payload);
      return;
    case runtimeSidecarEventNames.runProcessed:
      runTrackingEmitter.emit('run-parser:run-processed', payload);
      return;
    case runtimeSidecarEventNames.incubatorsUpdated:
      killTrackerEmitter.emit('incubatorsUpdated', payload);
      return;
    case runtimeSidecarEventNames.incubatorsMissing:
      killTrackerEmitter.emit('incubatorsMissing', payload);
      return;
    case runtimeSidecarEventNames.ratesGettingPrices:
      ratesEmitter.emit('gettingPrices');
      return;
    case runtimeSidecarEventNames.ratesDoneGettingPrices:
      ratesEmitter.emit('doneGettingPrices');
      return;
    case runtimeSidecarEventNames.ratesGettingPricesFailed:
      ratesEmitter.emit('gettingPricesFailed');
      return;
    case runtimeSidecarEventNames.pricesUpdated:
      ratesEmitter.emit('pricesUpdated', payload);
      pricesEmitter.emit('pricesUpdated', payload);
      return;
    case runtimeSidecarEventNames.clientTxtFileError:
      clientLogsEmitter.emit('clientTxtFileError', payload);
      return;
    case runtimeSidecarEventNames.clientTxtNotUpdated:
      clientLogsEmitter.emit('clientTxtNotUpdated', payload);
      return;
    case runtimeSidecarEventNames.localChatDisabled:
      logIngestEmitter.emit('client-logs:error:local-chat-disabled');
      return;
    case runtimeSidecarEventNames.generatedRun:
      logIngestEmitter.emit('client-logs:generated-run', payload);
      return;
    case runtimeSidecarEventNames.enteredMap:
      logIngestEmitter.emit('client-logs:entered-map', payload);
      return;
    case runtimeSidecarEventNames.stashTabsUpdatedFull:
      stashEmitter.emit('stashTabs:updated:full', payload);
      return;
    case runtimeSidecarEventNames.netWorthUpdated:
      stashEmitter.emit('netWorthUpdated', payload);
      return;
    default:
      return;
  }
}

function handleSidecarMessage(message: any) {
  if (!message || typeof message !== 'object') {
    return;
  }

  switch (message.type) {
    case 'ready':
      emitHealthUpdate({
        status: 'ready',
        pid: message.pid,
        startedAt: message.startedAt,
        lastHeartbeatAt: new Date().toISOString(),
        lastError: null,
      });
      startupResolve?.(message);
      return;
    case 'event':
      routeEvent(message.eventName, message.payload);
      return;
    case 'response': {
      const pending = pendingRequests.get(message.requestId);
      if (!pending) {
        return;
      }

      clearTimeout(pending.timeout);
      pendingRequests.delete(message.requestId);

      if (message.ok) {
        if (message.result?.status === 'ready') {
          consecutiveHealthCheckFailures = 0;
          emitHealthUpdate({
            ...message.result,
            status: 'ready',
            lastHeartbeatAt: new Date().toISOString(),
            lastError: null,
          });
        }
        pending.resolve(message.result);
      } else {
        pending.reject(new Error(message.error?.message ?? 'Runtime sidecar request failed'));
      }
      return;
    }
  }
}

function attachSidecarLogging(child: ChildProcess) {
  if (child.stdout) {
    child.stdout.on('data', (chunk) => {
      const output = chunk.toString().trim();
      if (output) {
        logger.info(`[runtime-sidecar:${child.pid}] ${output}`);
      }
    });
  }

  if (child.stderr) {
    child.stderr.on('data', (chunk) => {
      const output = chunk.toString().trim();
      if (output) {
        logger.error(`[runtime-sidecar:${child.pid}] ${output}`);
      }
    });
  }
}

function createStartupPromise() {
  startupPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      startupResolve = null;
      startupReject = null;
      reject(createTimeoutError('startup', StartupTimeoutMs));
    }, StartupTimeoutMs);

    startupResolve = (message) => {
      clearTimeout(timeout);
      startupResolve = null;
      startupReject = null;
      resolve(message);
    };
    startupReject = (error) => {
      clearTimeout(timeout);
      startupResolve = null;
      startupReject = null;
      reject(error);
    };
  });
}

function spawnSidecar() {
  const entryPath = getRuntimeSidecarEntryPath({
    currentMainDir: __dirname,
    isDev,
  });

  logger.info(`Starting runtime sidecar from ${entryPath}`);
  emitHealthUpdate({
    status: restartCount > 0 ? 'restarting' : 'starting',
    pid: null,
    startedAt: null,
    uptimeSeconds: 0,
    lastHeartbeatAt: null,
    lastError: null,
  });
  createStartupPromise();
  const userDataPath = process.env.EXILE_DIARY_USER_DATA_PATH ?? getUserDataPath();
  sidecarProcess = fork(entryPath, [], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      EXILE_DIARY_APP_VERSION: process.env.EXILE_DIARY_APP_VERSION ?? getAppVersion(),
      EXILE_DIARY_IS_PACKAGED: String(
        readBooleanEnv(process.env.EXILE_DIARY_IS_PACKAGED) ?? getIsPackaged()
      ),
      EXILE_DIARY_USER_DATA_PATH: userDataPath,
    },
    execArgv: isDev ? ['--require', 'tsx/cjs'] : [],
    serialization: 'advanced',
    stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
  });

  attachSidecarLogging(sidecarProcess);
  sidecarProcess.on('message', handleSidecarMessage);
  sidecarProcess.once('exit', (code, signal) => {
    const error = createSidecarExitError(code, signal);
    if (startupReject) {
      startupReject(error);
    }
    rejectPendingRequests(error);
    sidecarProcess = null;
    startupPromise = null;
    healthCheckPromise = null;

    if (!isStopping) {
      restartCount += 1;
      emitHealthUpdate({
        status: 'restarting',
        pid: null,
        uptimeSeconds: 0,
        lastExitReason: error.message,
        lastError: error.message,
      });
      logger.error(error.message);
      scheduleRestart();
    } else {
      consecutiveHealthCheckFailures = 0;
      emitHealthUpdate({
        status: 'stopped',
        pid: null,
        uptimeSeconds: 0,
        lastExitReason: error.message,
      });
    }
  });
  sidecarProcess.once('error', (error) => {
    logger.error('Runtime sidecar process error', error);
  });
}

function readBooleanEnv(value: string | undefined) {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return undefined;
}

function scheduleRestart() {
  if (isStopping || restartTimer) {
    return;
  }

  restartTimer = setTimeout(() => {
    restartTimer = null;
    ensureStarted().catch((error) => {
      logger.error('Failed to restart runtime sidecar', error);
    });
  }, RestartDelayMs);
}

function beginHealthChecks() {
  if (healthCheckTimer) {
    return;
  }

  healthCheckTimer = setInterval(() => {
    refreshHealth({ allowRestartOnFailure: true }).catch((error) => {
      logger.error('Runtime sidecar health check failed', error);
    });
  }, HealthCheckIntervalMs);

  if (typeof healthCheckTimer.unref === 'function') {
    healthCheckTimer.unref();
  }
}

async function sendRequestInternal<T = unknown>(
  command: RuntimeSidecarRequest['command'],
  payload: any = undefined,
  timeoutMs = RequestTimeoutMs
): Promise<T> {
  const requestId = `runtime-${++requestSequence}`;

  if (!sidecarProcess || !sidecarProcess.connected) {
    throw new Error('Runtime sidecar process is not available');
  }

  const child = sidecarProcess;

  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(createTimeoutError(command, timeoutMs));
    }, timeoutMs);

    pendingRequests.set(requestId, {
      resolve,
      reject,
      timeout,
    });

    try {
      child.send({
        type: 'request',
        requestId,
        command,
        payload,
      });
    } catch (error) {
      clearTimeout(timeout);
      pendingRequests.delete(requestId);
      reject(error);
    }
  });
}

export async function refreshHealth({ allowRestartOnFailure = false } = {}) {
  if (!sidecarProcess || !sidecarProcess.connected) {
    return latestHealth;
  }

  if (healthCheckPromise) {
    return healthCheckPromise;
  }

  healthCheckPromise = sendRequestInternal<Record<string, any>>(
    'health-check',
    undefined,
    HealthCheckTimeoutMs
  )
    .then((result) => {
      consecutiveHealthCheckFailures = 0;
      return emitHealthUpdate({
        ...result,
        status: 'ready',
        lastHeartbeatAt: new Date().toISOString(),
        lastError: null,
      });
    })
    .catch((error) => {
      consecutiveHealthCheckFailures += 1;
      const shouldRestart =
        allowRestartOnFailure &&
        consecutiveHealthCheckFailures >= MaxConsecutiveHealthCheckFailures;

      emitHealthUpdate({
        status: shouldRestart ? 'restarting' : 'degraded',
        lastError: error.message,
      });

      if (shouldRestart && sidecarProcess && !sidecarProcess.killed) {
        logger.error(
          `Runtime sidecar health check failed ${consecutiveHealthCheckFailures} times, restarting`
        );
        sidecarProcess.kill();
      }

      throw error;
    })
    .finally(() => {
      healthCheckPromise = null;
    });

  return healthCheckPromise;
}

async function ensureStarted() {
  if (!sidecarProcess || !sidecarProcess.connected) {
    isStopping = false;
    clearRestartTimer();
    spawnSidecar();
  }

  await startupPromise;
  beginHealthChecks();
  await refreshHealth();

  if (!Object.keys(settingsSnapshot).length) {
    settingsSnapshot = await sendRequestInternal<Record<string, any>>('renderer-method', {
      method: 'getSettings',
      args: [[]],
    });
  }
}

async function sendRequest<T = unknown>(
  command: RuntimeSidecarRequest['command'],
  payload: any = undefined,
  timeoutMs = RequestTimeoutMs
): Promise<T> {
  await ensureStarted();
  return sendRequestInternal<T>(command, payload, timeoutMs);
}

export async function start() {
  await ensureStarted();
}

export async function callRendererMethod<T = unknown>(
  method: RuntimeRendererMethodKey,
  args: any[] = []
) {
  return sendRequest<T>('renderer-method', { method, args });
}

export async function callRuntimeMethod<T = unknown>(method: RuntimeMethodKey, args: any[] = []) {
  return sendRequest<T>('runtime-method', { method, args });
}

export async function stop() {
  isStopping = true;
  clearRestartTimer();
  clearHealthCheckTimer();
  healthCheckPromise = null;

  const child = sidecarProcess;
  sidecarProcess = null;
  startupPromise = null;
  consecutiveHealthCheckFailures = 0;
  emitHealthUpdate({
    status: 'stopped',
    pid: null,
    uptimeSeconds: 0,
    lastError: null,
  });

  if (!child || child.killed) {
    return;
  }

  try {
    child.send({
      type: 'request',
      requestId: `runtime-stop-${Date.now()}`,
      command: 'shutdown',
    });
  } catch (error) {
    logger.error('Unable to send runtime sidecar shutdown request', error);
  }

  await new Promise<void>((resolve) => {
    const killTimer = setTimeout(() => {
      if (!child.killed) {
        child.kill();
      }
    }, 3000);

    child.once('exit', () => {
      clearTimeout(killTimer);
      resolve();
    });
  });
}

export async function restart() {
  await stop();
  settingsSnapshot = {};
  await start();
}

export function getHealth() {
  return latestHealth;
}

export function getSettingsSnapshot() {
  return settingsSnapshot;
}

export function getLatestGeneratedArea() {
  return latestGeneratedArea;
}
