const { fork } = require('node:child_process');
const Logger = require('electron-log');
const EventEmitter = require('events');
const { getOcrSidecarEntryPath } = require('../../runtime/electronViteRuntimePaths');

const logger = Logger.scope('ocr-watcher');
const emitter = new EventEmitter();
const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);
const StartupTimeoutMs = 20000;
const RequestTimeoutMs = 30000;
const RestartDelayMs = 500;

let sidecarProcess = null;
let startupPromise = null;
let startupResolve = null;
let startupReject = null;
let restartTimer = null;
let isStopping = false;
let requestSequence = 0;
let latestHealth = null;
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
      latestHealth = {
        status: 'ready',
        pid: message.pid,
        startedAt: message.startedAt,
      };
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
          latestHealth = message.result;
        }
        pending.resolve(message.result);
      } else {
        pending.reject(new Error(message.error?.message ?? 'OCR sidecar request failed'));
      }
      return;
    }
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
  createStartupPromise();
  sidecarProcess = fork(entryPath, [], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
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
    latestHealth = null;

    if (!isStopping) {
      logger.error(error.message);
      scheduleRestart();
    }
  });
  sidecarProcess.once('error', (error) => {
    logger.error('OCR sidecar process error', error);
  });
}

async function ensureStarted() {
  if (!sidecarProcess || !sidecarProcess.connected) {
    isStopping = false;
    clearRestartTimer();
    spawnSidecar();
  }

  await startupPromise;
  await sendRequestInternal('health-check');
}

async function sendRequestInternal(command, payload = undefined, timeoutMs = RequestTimeoutMs) {
  const requestId = `ocr-${++requestSequence}`;

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

    sidecarProcess.send({
      type: 'request',
      requestId,
      command,
      payload,
    });
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

  const child = sidecarProcess;
  sidecarProcess = null;
  startupPromise = null;
  latestHealth = null;

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
  checkJobComplete: () => latestHealth,
};
