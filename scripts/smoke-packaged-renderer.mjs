import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { _electron as electron } from 'playwright';

const rootDir = process.cwd();
const packageDir = process.env.PACKAGED_APP_DIR
  ? path.resolve(process.env.PACKAGED_APP_DIR)
  : path.join(rootDir, 'dist', 'win-unpacked');
const executablePath = path.join(packageDir, 'Exile Diary Reborn.exe');
const smokeDir = path.join(rootDir, '.tmp', 'packaged-renderer-smoke');
const recoveryPath = path.join(smokeDir, 'gpu-startup-recovery.json');

await fs.rm(smokeDir, { force: true, recursive: true });
await fs.mkdir(smokeDir, { recursive: true });
await fs.writeFile(
  recoveryPath,
  JSON.stringify({
    pendingLaunch: false,
    lastLaunchMode: 'gpu-safe',
    preferGpuSafeMode: true,
    lastRecoveryReason: 'previous-incomplete-startup',
  })
);

const electronApp = await electron.launch({
  executablePath,
  env: {
    ...process.env,
    EXILE_DIARY_USER_DATA_PATH: smokeDir,
  },
});

try {
  await electronApp.firstWindow({ timeout: 30_000 });

  const deadline = Date.now() + 30_000;
  let mainPage;
  let overlayPage;
  while (Date.now() < deadline) {
    for (const page of electronApp.windows()) {
      if (page.url().endsWith('#/login')) mainPage = page;
      if (page.url().endsWith('#/overlay')) overlayPage = page;
    }
    if (mainPage && overlayPage) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (!mainPage || !overlayPage) {
    throw new Error('Packaged app did not create both the main and overlay renderer windows.');
  }

  await mainPage.getByRole('button', { name: /login with poe/i }).waitFor({ timeout: 30_000 });

  const gpuState = await electronApp.evaluate(({ app }) => ({
    disableGpuSandbox: app.commandLine.hasSwitch('disable-gpu-sandbox'),
    useAngle: app.commandLine.getSwitchValue('use-angle'),
  }));
  const recoveryState = JSON.parse(await fs.readFile(recoveryPath, 'utf8'));
  const mainBackground = await mainPage.evaluate(() => getComputedStyle(document.body).background);
  const overlayBackground = await overlayPage.evaluate(
    () => getComputedStyle(document.body).backgroundColor
  );

  if (gpuState.disableGpuSandbox || gpuState.useAngle) {
    throw new Error(
      `Legacy recovery state incorrectly enabled GPU safe mode: ${JSON.stringify(gpuState)}`
    );
  }
  if (recoveryState.preferGpuSafeMode !== false) {
    throw new Error('Legacy false-positive GPU recovery preference was not cleared.');
  }
  if (!mainBackground.includes('rgb(0, 0, 0)')) {
    throw new Error(`Main renderer startup background is not black: ${mainBackground}`);
  }
  if (overlayBackground !== 'rgba(0, 0, 0, 0)') {
    throw new Error(`Overlay renderer is not transparent: ${overlayBackground}`);
  }

  console.log('Packaged renderer: main UI rendered and legacy GPU state recovered cleanly.');
} finally {
  await electronApp.close();
}
