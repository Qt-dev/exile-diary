import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const project = process.argv[2] ?? 'chromium';
const rootDir = process.cwd();
const harnessUrl = 'http://127.0.0.1:4173/test/ui/';
const viteCli = path.resolve(rootDir, 'node_modules/vite/bin/vite.js');
const playwrightCli = path.resolve(rootDir, 'node_modules/@playwright/test/cli.js');
let viteProcess;

const isHarnessReady = async () => {
  try {
    return (await fetch(harnessUrl)).ok;
  } catch {
    return false;
  }
};

const waitForHarness = async () => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await isHarnessReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`UI harness did not become ready at ${harnessUrl}`);
};

const runPlaywright = () =>
  new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [playwrightCli, 'test', '--config', 'playwright.ui.config.ts', '--project', project],
      { cwd: rootDir, stdio: 'inherit', windowsHide: true }
    );
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });

try {
  if (!(await isHarnessReady())) {
    viteProcess = spawn(process.execPath, [viteCli, '--config', 'vite.ui-test.config.ts'], {
      cwd: rootDir,
      stdio: ['ignore', 'inherit', 'inherit'],
      windowsHide: true,
    });
    viteProcess.once('error', (error) => {
      throw error;
    });
    await waitForHarness();
  }

  process.exitCode = await runPlaywright();
} finally {
  if (viteProcess && viteProcess.exitCode === null) {
    viteProcess.kill();
  }
}
