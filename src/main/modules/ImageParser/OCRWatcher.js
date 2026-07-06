const { fork } = require('node:child_process');
const Logger = require('electron-log');
const EventEmitter = require('events');
const { getOcrSidecarEntryPath } = require('../../runtime/electronViteRuntimePaths');
const { getAppVersion, getIsPackaged, getUserDataPath } = require('../../runtime/getUserDataPath');

const logger = Logger.scope('ocr-watcher');
const emitter = new EventEmitter();
const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);
const StartupTimeoutMs = 20000;
const RequestTimeoutMs = 30000;
const RestartDelayMs = 500;
const HealthCheckIntervalMs = 15000;
const HealthCheckTimeoutMs = 5000;
const MaxConsecutiveHealthCheckFailures = 2;

let sidecarProcess = null;
let startupPromise = null;
let startupResolve = null;
let startupReject = null;
let restartTimer = null;
let healthCheckTimer = null;
let healthCheckPromise = null;
let isStopping = false;
let requestSequence = 0;
let restartCount = 0;
let consecutiveHealthCheckFailures = 0;
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
const pendingRequests = new Map();

function createTimeoutError(action, timeoutMs) {
  return new Error(`OCR sidecar timed out while waiting for ${action} after ${timeoutMs}ms`);
}

function createSidecarExitError(code, signal) {
  const reason = signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`;
  return new Error(`OCR sidecar exited unexpectedly (${reason})`);
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

function emitHealthUpdate(partial = {}) {
  latestHealth = {
    ...latestHealth,
    ...partial,
    restartCount,
    consecutiveHealthCheckFailures,
    pendingRequestCount: pendingRequests.size,
  };

  emitter.emit('ocr:health-updated', latestHealth);
  return latestHealth;
}

function rejectPendingRequests(error) {
  for (const { reject, timeout } of pendingRequests.values()) {
    clearTimeout(timeout);
    reject(error);
  }
  pendingRequests.clear();
}

function handleSidecarMessage(message) {
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
        uptimeSeconds: 0,
        lastError: null,
      });
      startupResolve?.(message);
      return;
    case 'event':
      if (message.eventName) {
        emitter.emit(message.eventName, message.payload);
      }
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
        pending.reject(new Error(message.error?.message ?? 'OCR sidecar request failed'));
      }
      return;
    }
  }
}

function beginHealthChecks() {
  if (healthCheckTimer) {
    return;
  }

  healthCheckTimer = setInterval(() => {
    refreshHealth({ allowRestartOnFailure: true }).catch((error) => {
      logger.error('OCR sidecar health check failed', error);
    });
  }, HealthCheckIntervalMs);

  if (typeof healthCheckTimer.unref === 'function') {
    healthCheckTimer.unref();
  }
}

function scheduleRestart() {
  if (isStopping || restartTimer) {
    return;
  }

  restartTimer = setTimeout(() => {
    restartTimer = null;
    ensureStarted().catch((error) => {
      logger.error('Failed to restart OCR sidecar', error);
    });
  }, RestartDelayMs);
}

function attachSidecarLogging(child) {
  if (child.stdout) {
    child.stdout.on('data', (chunk) => {
      const output = chunk.toString().trim();
      if (output) {
        logger.info(`[ocr-sidecar:${child.pid}] ${output}`);
      }
    });
  }

  if (child.stderr) {
    child.stderr.on('data', (chunk) => {
      const output = chunk.toString().trim();
      if (output) {
        logger.error(`[ocr-sidecar:${child.pid}] ${output}`);
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
  const entryPath = getOcrSidecarEntryPath({
    currentMainDir: __dirname,
    isDev,
  });

  logger.info(`Starting OCR sidecar from ${entryPath}`);
  emitHealthUpdate({
    status: restartCount > 0 ? 'restarting' : 'starting',
    pid: null,
    startedAt: null,
    uptimeSeconds: 0,
    lastHeartbeatAt: null,
    lastError: null,
  });
  createStartupPromise();
  const userDataPath = process.env.EXILE_DIARY_USER_DATA_PATH || getUserDataPath();
  sidecarProcess = fork(entryPath, [], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      EXILE_DIARY_APP_VERSION: process.env.EXILE_DIARY_APP_VERSION || getAppVersion(),
      EXILE_DIARY_DISABLE_FILE_LOGGING: '1',
      EXILE_DIARY_IS_PACKAGED: process.env.EXILE_DIARY_IS_PACKAGED || String(getIsPackaged()),
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
    logger.error('OCR sidecar process error', error);
  });
}

async function refreshHealth({ allowRestartOnFailure = false } = {}) {
  if (!sidecarProcess || !sidecarProcess.connected) {
    return latestHealth;
  }

  if (healthCheckPromise) {
    return healthCheckPromise;
  }

  healthCheckPromise = sendRequestInternal('health-check', undefined, HealthCheckTimeoutMs)
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
          `OCR sidecar health check failed ${consecutiveHealthCheckFailures} times, restarting`
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
}

async function sendRequestInternal(command, payload = undefined, timeoutMs = RequestTimeoutMs) {
  const requestId = `ocr-${++requestSequence}`;

  if (!sidecarProcess || !sidecarProcess.connected) {
    throw new Error('OCR sidecar process is not available');
  }

  return new Promise((resolve, reject) => {
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
      sidecarProcess.send({
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

async function sendRequest(command, payload = undefined, timeoutMs = RequestTimeoutMs) {
  await ensureStarted();
  return sendRequestInternal(command, payload, timeoutMs);
}

async function start() {
  await ensureStarted();
}

async function scanScreenshotBuffer(screenshotBuffer, job, options = {}) {
  return sendRequest('scan-screenshot-buffer', {
    screenshotBuffer,
    job,
    options,
  });
}

async function processImageBuffer(buffer, timestamp, type) {
  if (type !== 'mods') {
    return null;
  }

  return sendRequest('process-image-buffer', {
    buffer,
    timestamp,
    type,
  });
}

async function stop() {
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
      requestId: `ocr-stop-${Date.now()}`,
      command: 'shutdown',
    });
  } catch (error) {
    logger.error('Unable to send OCR sidecar shutdown request', error);
  }

  await new Promise((resolve) => {
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

module.exports = {
  start,
  emitter,
  processImageBuffer,
  scanScreenshotBuffer,
  stop,
  refreshHealth,
  getHealth: () => latestHealth,
  checkJobComplete: () => latestHealth,
};
