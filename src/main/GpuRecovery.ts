import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export const GPU_SAFE_MODE_ARG = '--exile-diary-disable-gpu';

const RECOVERY_STATE_FILE = 'gpu-startup-recovery.json';
const GPU_FAILURE_THRESHOLD = 3;

type LaunchMode = 'normal' | 'gpu-safe';

type RecoveryState = {
  pendingLaunch: boolean;
  startedAt: string;
  lastLaunchMode: LaunchMode;
  preferGpuSafeMode?: boolean;
  lastRecoveryReason?: string;
  lastSuccessfulAt?: string;
  lastSuccessfulMode?: LaunchMode;
  lastGpuFailureAt?: string;
  lastGpuFailureReason?: string;
  gpuFailureCount?: number;
};

type GoneDetails = {
  type?: string;
  reason?: string;
  exitCode?: number;
  serviceName?: string;
  name?: string;
};

type RecoveryInitResult = {
  gpuSafeMode: boolean;
  recoveryReason: string | null;
};

type RecoveryFs = Pick<typeof fs, 'existsSync' | 'mkdirSync' | 'readFileSync' | 'writeFileSync'>;

type RecoveryApp = {
  disableHardwareAcceleration: () => void;
  commandLine: {
    appendSwitch: (switchName: string, value?: string) => void;
  };
};

type RecoveryDeps = {
  appLike?: RecoveryApp;
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  fsLike?: RecoveryFs;
  logInfo?: (...args: any[]) => void;
  logWarn?: (...args: any[]) => void;
  now?: () => string;
  userDataPath?: string;
};

export function createGpuRecoveryManager({
  appLike = app,
  argv = process.argv,
  env = process.env,
  fsLike = fs,
  logInfo = (...args: any[]) => console.log(...args),
  logWarn = (...args: any[]) => console.warn(...args),
  now = () => new Date().toISOString(),
  userDataPath = app.getPath('userData'),
}: RecoveryDeps = {}) {
  const stateFilePath = path.join(userDataPath, RECOVERY_STATE_FILE);
  let consecutiveGpuFailures = 0;
  let launchMode: LaunchMode = 'normal';
  let startupSucceeded = false;
  let relaunchQueued = false;

  function ensureStateDir() {
    fsLike.mkdirSync(path.dirname(stateFilePath), { recursive: true });
  }

  function readState(): RecoveryState | null {
    try {
      if (!fsLike.existsSync(stateFilePath)) {
        return null;
      }

      return JSON.parse(fsLike.readFileSync(stateFilePath, 'utf8')) as RecoveryState;
    } catch (error) {
      logWarn('[gpu-recovery] Failed to read recovery state:', error);
      return null;
    }
  }

  function writeState(state: RecoveryState) {
    try {
      ensureStateDir();
      fsLike.writeFileSync(stateFilePath, JSON.stringify(state, null, 2));
    } catch (error) {
      logWarn('[gpu-recovery] Failed to write recovery state:', error);
    }
  }

  function getRelaunchArgs() {
    const args = argv.slice(1).filter((arg) => arg !== GPU_SAFE_MODE_ARG);
    args.push(GPU_SAFE_MODE_ARG);
    return args;
  }

  function enableGpuSafeMode(reason: string) {
    launchMode = 'gpu-safe';
    logWarn(`[gpu-recovery] Enabling GPU safe mode (${reason}).`);
    appLike.commandLine.appendSwitch('use-angle', 'swiftshader');
    appLike.commandLine.appendSwitch('ignore-gpu-blocklist');
    appLike.commandLine.appendSwitch('disable-gpu-sandbox');
  }

  function initialize(): RecoveryInitResult {
    const existingState = readState();
    const explicitGpuSafeMode =
      argv.includes(GPU_SAFE_MODE_ARG) || env.EXILE_DIARY_DISABLE_GPU === '1';
    const previousLaunchDidNotFinish = existingState?.pendingLaunch === true;
    const preferredGpuSafeMode = existingState?.preferGpuSafeMode === true;

    let recoveryReason: string | null = null;

    if (explicitGpuSafeMode) {
      recoveryReason = 'explicit-safe-mode-flag';
    } else if (previousLaunchDidNotFinish) {
      recoveryReason = 'previous-incomplete-startup';
    } else if (preferredGpuSafeMode) {
      recoveryReason = 'persisted-safe-mode';
    }

    if (recoveryReason) {
      enableGpuSafeMode(recoveryReason);
    }

    writeState({
      ...existingState,
      pendingLaunch: true,
      startedAt: now(),
      lastLaunchMode: launchMode,
      lastRecoveryReason: recoveryReason ?? undefined,
      gpuFailureCount: 0,
    });

    return {
      gpuSafeMode: launchMode === 'gpu-safe',
      recoveryReason,
    };
  }

  function markStartupSuccessful() {
    startupSucceeded = true;
    consecutiveGpuFailures = 0;

    const existingState = readState();
    writeState({
      ...existingState,
      pendingLaunch: false,
      startedAt: existingState?.startedAt ?? now(),
      lastLaunchMode: launchMode,
      preferGpuSafeMode: launchMode === 'gpu-safe',
      lastSuccessfulAt: now(),
      lastSuccessfulMode: launchMode,
      gpuFailureCount: 0,
      lastGpuFailureAt: existingState?.lastGpuFailureAt,
      lastGpuFailureReason: existingState?.lastGpuFailureReason,
    });
  }

  function handleGpuProcessGone(details: GoneDetails) {
    if (startupSucceeded || relaunchQueued || launchMode === 'gpu-safe') {
      return false;
    }

    const processType = details.type?.toLowerCase?.() ?? '';
    if (processType !== 'gpu') {
      return false;
    }

    consecutiveGpuFailures += 1;
    const failureReason =
      details.reason ??
      details.serviceName ??
      details.name ??
      `exit-code-${details.exitCode ?? 'unknown'}`;

    const existingState = readState();
    writeState({
      ...existingState,
      pendingLaunch: true,
      startedAt: existingState?.startedAt ?? now(),
      lastLaunchMode: launchMode,
      preferGpuSafeMode: true,
      gpuFailureCount: consecutiveGpuFailures,
      lastGpuFailureAt: now(),
      lastGpuFailureReason: failureReason,
    });

    logWarn(
      `[gpu-recovery] GPU child process exited during startup (${consecutiveGpuFailures}/${GPU_FAILURE_THRESHOLD}): ${failureReason}`
    );

    if (consecutiveGpuFailures < GPU_FAILURE_THRESHOLD) {
      return false;
    }

    relaunchQueued = true;
    return true;
  }

  function isGpuSafeModeEnabled() {
    return launchMode === 'gpu-safe';
  }

  return {
    getRelaunchArgs,
    handleGpuProcessGone,
    initialize,
    isGpuSafeModeEnabled,
    markStartupSuccessful,
    stateFilePath,
  };
}
