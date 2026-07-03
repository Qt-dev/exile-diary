import { spawn } from 'node:child_process';
import path from 'node:path';

export type AppLifecycleMode = 'startup' | 'idle-memory';

export type AppLifecycleBenchmarkReport = {
  benchmark: 'app-lifecycle';
  mode: AppLifecycleMode;
  status: 'ok' | 'error';
  raw?: Record<string, unknown>;
  error?: string;
};

function getElectronBinary() {
  const executable = process.platform === 'win32' ? 'electron.cmd' : 'electron';
  return path.join(process.cwd(), 'node_modules', '.bin', executable);
}

export async function runAppLifecycleBenchmark(
  mode: AppLifecycleMode
): Promise<AppLifecycleBenchmarkReport> {
  const startedAt = Date.now();
  const electronBinary = getElectronBinary();

  return new Promise((resolve, reject) => {
    const child = spawn(electronBinary, ['.'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        EXILE_DIARY_BENCHMARK_MODE: mode,
        EXILE_DIARY_BENCHMARK_STARTED_AT: String(startedAt),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', (code) => {
      const markerLine = stdout
        .split(/\r?\n/)
        .find((line) => line.startsWith('__EXILE_DIARY_BENCHMARK__'));

      if (!markerLine) {
        resolve({
          benchmark: 'app-lifecycle',
          mode,
          status: 'error',
          error:
            `No benchmark marker received for mode "${mode}". This usually means the compiled Electron main bundle is stale or another app instance took the single-instance lock.\n` +
            `Rebuild the main process bundle before collecting lifecycle baselines.\nExit code: ${code ?? 'unknown'}\nSTDERR:\n${stderr}\nSTDOUT:\n${stdout}`,
        });
        return;
      }

      const payload = JSON.parse(markerLine.replace('__EXILE_DIARY_BENCHMARK__', ''));
      resolve({
        benchmark: 'app-lifecycle',
        mode,
        status: 'ok',
        raw: payload,
      });
    });
  });
}

if (require.main === module) {
  const modeArg = process.argv.find((arg) => arg.startsWith('--mode='))?.split('=')[1];
  const mode = modeArg === 'idle-memory' ? 'idle-memory' : 'startup';

  runAppLifecycleBenchmark(mode)
    .then((report) => {
      if (process.argv.includes('--json')) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(`${report.mode} benchmark ${report.status}`);
        console.log(JSON.stringify(report.raw ?? { error: report.error }, null, 2));
      }
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
