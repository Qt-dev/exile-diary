import { fork } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const packageDir = path.resolve(process.argv[2] ?? path.join('dist', 'win-unpacked'));
const executablePath = path.join(packageDir, 'Exile Diary Reborn.exe');
const resourcesPath = path.join(packageDir, 'resources');
const packagedMainDir = path.join(resourcesPath, 'app.asar', 'out', 'electron', 'main');

function assertPackagedFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Packaged sidecar smoke prerequisite is missing: ${filePath}`);
  }
}

async function smokeSidecar({ name, entryFile, extraEnv = {}, timeoutMs = 60000 }) {
  const userDataPath = path.join(rootDir, '.tmp', 'packaged-sidecar-smoke', name);
  fs.mkdirSync(userDataPath, { recursive: true });

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    EXILE_DIARY_APP_VERSION: 'packaged-sidecar-smoke',
    EXILE_DIARY_DISABLE_FILE_LOGGING: '1',
    EXILE_DIARY_IS_PACKAGED: 'true',
    EXILE_DIARY_USER_DATA_PATH: userDataPath,
    ...extraEnv,
  };
  delete env.ELECTRON_RENDERER_URL;

  const entryPath = path.join(packagedMainDir, entryFile);

  await new Promise((resolve, reject) => {
    const child = fork(entryPath, [], {
      env,
      execPath: executablePath,
      serialization: 'advanced',
      silent: true,
    });
    let healthCheckPassed = false;
    let stderr = '';

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`${name} sidecar smoke timed out.\n${stderr}`));
    }, timeoutMs);

    child.on('message', (message) => {
      if (message?.type === 'ready') {
        child.send({
          type: 'request',
          requestId: `${name}-health`,
          command: 'health-check',
        });
        return;
      }

      if (message?.type === 'response' && message.requestId === `${name}-health`) {
        if (!message.ok || message.result?.status !== 'ready') {
          child.kill();
          reject(new Error(`${name} sidecar returned an unhealthy response.\n${stderr}`));
          return;
        }

        healthCheckPassed = true;
        child.send({
          type: 'request',
          requestId: `${name}-shutdown`,
          command: 'shutdown',
        });
      }
    });

    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      if (!healthCheckPassed || code !== 0) {
        reject(
          new Error(
            `${name} sidecar exited before completing its health check ` +
              `(code ${code ?? 'unknown'}, signal ${signal ?? 'none'}).\n${stderr}`
          )
        );
        return;
      }

      console.log(`${name} packaged sidecar: ready, healthy, and stopped cleanly`);
      resolve();
    });
  });
}

assertPackagedFile(executablePath);
assertPackagedFile(path.join(resourcesPath, 'app.asar'));

await smokeSidecar({
  name: 'runtime',
  entryFile: 'runtime-sidecar.js',
  extraEnv: {
    EXILE_DIARY_BENCHMARK_MODE: '1',
  },
});

await smokeSidecar({
  name: 'ocr',
  entryFile: 'ocr-sidecar.js',
  extraEnv: {
    EXILE_DIARY_OCR_BENCHMARK_MODE: '1',
    EXILE_DIARY_TESSDATA_PATH: resourcesPath,
  },
  timeoutMs: 120000,
});
