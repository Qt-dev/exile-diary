import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const recoveryMarker =
  '[gpu-recovery] Repeated GPU startup failures detected. Relaunching in GPU safe mode.';
const devUserDataPath = process.env.EXILE_DIARY_USER_DATA_PATH || '.tmp/dev-user-data';
const volatileDevProfileDirs = [
  'Cache',
  'Code Cache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'GPUCache',
  'Network',
  'Session Storage',
  'Shared Dictionary',
  'blob_storage',
];

let hasRetriedWithGpuSafeMode = false;

function resetVolatileDevProfileDirs() {
  if (process.env.EXILE_DIARY_SKIP_DEV_PROFILE_CACHE_RESET === '1') {
    return;
  }

  const userDataPath = path.resolve(devUserDataPath);
  for (const profileDir of volatileDevProfileDirs) {
    const targetPath = path.join(userDataPath, profileDir);
    try {
      fs.rmSync(targetPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (error) {
      console.warn(`[dev-recovery] Could not reset volatile dev profile directory ${targetPath}:`);
      console.warn(error);
    }
  }
}

function forwardOutput(stream, writer, onText) {
  stream.on('data', (chunk) => {
    const text = chunk.toString();
    writer.write(text);
    onText(text);
  });
}

function runDevRaw(extraEnv = {}) {
  return new Promise((resolve) => {
    let sawRecoveryMarker = false;

    const child = spawn(npmCommand, ['run', 'dev:raw'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...extraEnv,
      },
      shell: isWindows,
      stdio: ['inherit', 'pipe', 'pipe'],
      windowsHide: true,
    });

    forwardOutput(child.stdout, process.stdout, (text) => {
      if (text.includes(recoveryMarker)) {
        sawRecoveryMarker = true;
      }
    });

    forwardOutput(child.stderr, process.stderr, (text) => {
      if (text.includes(recoveryMarker)) {
        sawRecoveryMarker = true;
      }
    });

    child.once('exit', (code) => {
      resolve({
        code: code ?? 0,
        sawRecoveryMarker,
      });
    });
  });
}

async function main() {
  resetVolatileDevProfileDirs();

  const firstAttempt = await runDevRaw();
  if (!firstAttempt.sawRecoveryMarker) {
    process.exit(firstAttempt.code);
  }

  if (hasRetriedWithGpuSafeMode) {
    process.exit(firstAttempt.code);
  }

  hasRetriedWithGpuSafeMode = true;
  console.log('[dev-recovery] Restarting dev mode in GPU safe mode after startup GPU failures.');

  const secondAttempt = await runDevRaw({
    EXILE_DIARY_DISABLE_GPU: '1',
  });

  process.exit(secondAttempt.code);
}

void main();
