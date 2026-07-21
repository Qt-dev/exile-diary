import { spawn } from 'node:child_process';
import fs from 'node:fs';
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
  if (process.platform === 'win32') {
    return path.join(process.cwd(), 'node_modules', 'electron', 'dist', 'electron.exe');
  }

  return path.join(process.cwd(), 'node_modules', '.bin', 'electron');
}

export async function runAppLifecycleBenchmark(
  mode: AppLifecycleMode
): Promise<AppLifecycleBenchmarkReport> {
  const startedAt = Date.now();
  const electronBinary = getElectronBinary();
  const timeoutMs = mode === 'startup' ? 30000 : 45000;
  const benchmarkUserDataPath = path.join(
    process.cwd(),
    '.tmp',
    'app-benchmarks',
    `${mode}-${process.pid}-${startedAt}`
  );

  fs.mkdirSync(benchmarkUserDataPath, { recursive: true });

  return new Promise((resolve, reject) => {
    const child = spawn(electronBinary, ['--use-angle=swiftshader', '.', '--disable-gpu-sandbox'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        EXILE_DIARY_BENCHMARK_MODE: mode,
        EXILE_DIARY_BENCHMARK_STARTED_AT: String(startedAt),
        EXILE_DIARY_USER_DATA_PATH: benchmarkUserDataPath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finalize = (report: AppLifecycleBenchmarkReport) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      resolve(report);
    };

    const timeoutId = setTimeout(() => {
      child.kill();
      finalize({
        benchmark: 'app-lifecycle',
        mode,
        status: 'error',
        error:
          `Timed out after ${timeoutMs}ms while waiting for the Electron app to report "${mode}".\n` +
          `This usually means the main renderer never emitted its boot-ready signal in the current environment.\nSTDERR:\n${stderr}\nSTDOUT:\n${stdout}`,
      });
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', (code) => {
      if (settled) {
        return;
      }

      const markerLine = stdout
        .split(/\r?\n/)
        .find((line) => line.startsWith('__EXILE_DIARY_BENCHMARK__'));

      if (!markerLine) {
        finalize({
          benchmark: 'app-lifecycle',
          mode,
          status: 'error',
          error:
            `No benchmark marker received for mode "${mode}". This usually means the built app output is stale or another app instance took the single-instance lock.\n` +
            `Run the full app build before collecting lifecycle baselines.\nExit code: ${
              code ?? 'unknown'
            }\nSTDERR:\n${stderr}\nSTDOUT:\n${stdout}`,
        });
        return;
      }

      const payload = JSON.parse(markerLine.replace('__EXILE_DIARY_BENCHMARK__', ''));
      finalize({
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
