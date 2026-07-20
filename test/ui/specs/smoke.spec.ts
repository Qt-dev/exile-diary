import { expect, test } from '@playwright/test';
import {
  allowConsoleError,
  assertNoUnexpectedErrors,
  getHarnessCalls,
  harnessUrl,
  observeUnexpectedErrors,
  preparePage,
} from './harness';

test.beforeEach(async ({ page }) => {
  observeUnexpectedErrors(page);
  await preparePage(page);
});

test.afterEach(async ({ page }, testInfo) => {
  assertNoUnexpectedErrors(page, testInfo);
});

test('boots the populated app and navigates through primary routes', async ({ page }) => {
  await page.goto(harnessUrl('populated'));
  await expect(page.getByText('Most Recent 3 Runs')).toBeVisible();
  await expect(page.getByText('v1.10.2-test')).toBeVisible();

  await page.getByRole('menuitem', { name: 'Stats' }).click();
  await expect(page.getByRole('heading', { name: /Stats for TestExile/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Area Stats' }).click();
  await expect(page.getByText('Area', { exact: true })).toBeVisible();

  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await expect(page.getByRole('tab', { name: 'Account' })).toBeVisible();
  await page.getByRole('tab', { name: 'Stashes' }).click();
  await page.getByRole('button', { name: 'Refresh Tabs' }).click();
  await expect(page.getByRole('button', { name: /CurrencyStash Currency/ })).toBeVisible();

  await page.getByRole('menuitem', { name: 'Stash' }).click();
  await expect(page.getByText('Stash Tabs', { exact: true })).toBeVisible();
  await expect(page.getByText('Divine Orb')).toBeVisible();

  await page.getByRole('menuitem', { name: 'Help' }).click();
  await expect(page.getByText(/This app is a tool to help you keep track/)).toBeVisible();
});

test('uses the unauthenticated fixture without opening an external browser', async ({ page }) => {
  await page.goto(harnessUrl('unauthenticated'));
  const login = page.getByRole('button', { name: 'Login with PoE' });
  await expect(login).toBeVisible();
  await login.click();
  await expect(page.getByText(/Please authenticate through the window/)).toBeVisible();

  const calls = await getHarnessCalls(page);
  expect(calls.some(({ method }) => method === 'openExternal')).toBe(true);
});

test('loads representative run details from the mocked preload API', async ({ page }) => {
  await page.goto(harnessUrl('populated'));
  await page.getByRole('row', { name: /Dunes Map/ }).click();

  await expect(page.getByText('Dunes Map', { exact: true })).toBeVisible();
  await expect(page.getByText('Monsters have 40% increased life')).toBeVisible();
  await expect(page.getByText(/You were slain/)).toBeVisible();
});

test('submits searches and renders fixture-backed results', async ({ page }) => {
  await page.goto(harnessUrl('populated', '/search'));
  await expect(page.getByRole('heading', { name: 'Search Criteria' })).toBeVisible();
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  await expect(page.getByText(/Stats for TestExile/)).toBeVisible();
  await page.getByRole('button', { name: /^Runs \(1 run/ }).click();
  await expect(page.getByRole('row', { name: /Dunes Map/ })).toBeVisible();
  const calls = await getHarnessCalls(page);
  expect(calls.some(({ method }) => method === 'triggerSearch')).toBe(true);
});

test('records settings saves without touching the filesystem', async ({ page }) => {
  await page.goto(harnessUrl('populated', '/settings'));
  const clientLog = page.getByLabel(/Path of Exile Client\.TXT Location/);
  await clientLog.fill('C:\\Fixture\\Client.txt');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect
    .poll(async () => {
      const calls = await getHarnessCalls(page);
      return calls.find(({ method }) => method === 'saveSettings');
    })
    .toBeTruthy();
});

test('can change fixture state and refresh the running UI', async ({ page }) => {
  await page.goto(harnessUrl('populated'));
  await expect(page.getByText('Most Recent 3 Runs')).toBeVisible();
  await page.evaluate(() => {
    const state = window.__exileDiaryTest.getState();
    window.__exileDiaryTest.setState({
      runs: [
        ...state.runs,
        {
          ...state.runs[0],
          id: 4,
          name: 'Mutable Fixture Map',
          first_event: '2025-01-01T19:00:00.000Z',
          last_event: '2025-01-01T19:10:00.000Z',
        },
      ],
    });
    window.__exileDiaryTest.emit('refreshRuns', undefined);
  });
  await expect(page.getByText('Most Recent 4 Runs')).toBeVisible();
  await expect(page.getByRole('row', { name: /Mutable Fixture Map/ })).toBeVisible();
});

test('can drive preload events through the overlay fixture controller', async ({ page }) => {
  await page.goto(harnessUrl('populated', '/overlay'));
  await expect(page.getByText(/Tracking Unknown/)).toBeVisible();
  await page.evaluate(() => {
    window.__exileDiaryTest.emit('overlayMessage', {
      messages: [{ text: 'Fixture overlay message', type: 'info' }],
    });
  });

  await expect(page.getByText('Fixture overlay message')).toBeVisible();
});

test('keeps the shell usable when the stats backend rejects', async ({ page }) => {
  allowConsoleError(page, /Fixture stats backend unavailable/);
  await page.goto(harnessUrl('backend-error', '/stats'));
  await expect(page.getByText('Loading Stats...')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Help' })).toBeVisible();
});

test('keeps core navigation available at the default Electron window size', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(harnessUrl('empty'));
  await expect(page.getByText('Most Recent 0 Runs')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Settings' })).toBeVisible();
});
