import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const electronBinaryPath = require('electron');
const electronPackage = require('electron/package.json');
const nativeModulesToCheck = ['better-sqlite3'];

function parseJsonLine(text) {
  const lines = (text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      return JSON.parse(lines[i]);
    } catch {
      continue;
    }
  }

  return null;
}

const probeScript = `
const nativeModulesToCheck = ${JSON.stringify(nativeModulesToCheck)};
const failures = [];

for (const moduleName of nativeModulesToCheck) {
  try {
    const loadedModule = require(moduleName);
    if (moduleName === 'better-sqlite3') {
      const db = new loadedModule(':memory:');
      db.prepare('select 1 as value').get();
      db.close();
    }
  } catch (error) {
    failures.push({
      moduleName,
      message: error?.message ?? String(error),
      stack: error?.stack ?? '',
    });
  }
}

console.log(JSON.stringify({
  electron: process.versions.electron ?? null,
  node: process.version,
  modules: process.versions.modules,
  failures,
}));

process.exit(failures.length === 0 ? 0 : 1);
`;

const result = spawnSync(electronBinaryPath, ['-e', probeScript], {
  encoding: 'utf8',
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
  },
  timeout: 20000,
  windowsHide: true,
});

if (result.error) {
  console.error('[native-check] Failed to start the Electron compatibility probe.');
  console.error(result.error.message);
  process.exit(1);
}

const probeResult = parseJsonLine(result.stdout);
const electronAbi = probeResult?.modules ?? 'unknown';
const electronVersion = probeResult?.electron ?? electronPackage.version;

if (result.status === 0 && probeResult) {
  console.log(
    `[native-check] Electron native dependencies look compatible (Electron ${electronVersion}, ABI ${electronAbi}).`
  );
  process.exit(0);
}

console.error('[native-check] Electron native dependency mismatch detected.');
console.error(
  `[native-check] Local Node is ${process.version} (ABI ${process.versions.modules}); Electron is ${electronVersion} (ABI ${electronAbi}).`
);

if (probeResult?.failures?.length) {
  for (const failure of probeResult.failures) {
    console.error(`[native-check] ${failure.moduleName}: ${failure.message}`);
  }
} else {
  if (result.stdout?.trim()) {
    console.error(result.stdout.trim());
  }
  if (result.stderr?.trim()) {
    console.error(result.stderr.trim());
  }
}

console.error(
  '[native-check] Rebuild Electron-native modules with: npx electron-builder install-app-deps'
);
console.error(
  '[native-check] Avoid running npm rebuild better-sqlite3 under your normal Node runtime unless you rebuild for Electron again afterward.'
);
process.exit(1);
