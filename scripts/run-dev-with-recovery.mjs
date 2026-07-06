import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const recoveryMarker =
  '[gpu-recovery] Repeated GPU startup failures detected. Relaunching in GPU safe mode.';

let hasRetriedWithGpuSafeMode = false;

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
