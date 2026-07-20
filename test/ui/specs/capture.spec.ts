import { expect, test } from '@playwright/test';
import {
  assertNoUnexpectedErrors,
  harnessUrl,
  observeUnexpectedErrors,
  preparePage,
} from './harness';

test.beforeEach(async ({ page }) => {
  observeUnexpectedErrors(page);
});

test.afterEach(async ({ page }, testInfo) => {
  assertNoUnexpectedErrors(page, testInfo);
});

test('captures representative application routes', async ({ page }, testInfo) => {
  await preparePage(page);
  await page.goto(harnessUrl('populated'));
  await expect(page.getByText('Most Recent 3 Runs')).toBeVisible();

  const capture = async (name: string) => {
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
  };

  await capture('run-list');

  await page.getByRole('row', { name: /Dunes Map/ }).click();
  await expect(page.getByText('Monsters have 40% increased life')).toBeVisible();
  await capture('run-details');

  await page.getByRole('menuitem', { name: 'Stats' }).click();
  await expect(page.getByRole('heading', { name: /Stats for TestExile/ })).toBeVisible();
  await capture('stats-main');
  for (const [tab, name] of [
    ['Area Stats', 'stats-area'],
    ['Boss Stats', 'stats-boss'],
    ['Loot Stats', 'stats-loot'],
  ] as const) {
    await page.getByRole('tab', { name: tab }).click();
    await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
    await capture(name);
  }

  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await expect(page.getByRole('tab', { name: 'Account' })).toBeVisible();
  await capture('settings-account');

  await page.getByRole('tab', { name: 'Stashes' }).click();
  await page.getByRole('button', { name: 'Refresh Tabs' }).click();
  await expect(page.getByRole('button', { name: /CurrencyStash Currency/ })).toBeVisible();
  await capture('settings-stashes');

  for (const [tab, name] of [
    ['Item Filter', 'settings-item-filter'],
    ['Hotkeys', 'settings-hotkeys'],
    ['Debug', 'settings-debug'],
  ] as const) {
    await page.getByRole('tab', { name: tab }).click();
    await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
    await capture(name);
  }

  await page.getByRole('menuitem', { name: 'Stash' }).click();
  await expect(page.getByText('Divine Orb')).toBeVisible();
  await capture('stash');

  await page.getByRole('menuitem', { name: 'Search' }).click();
  await expect(page.getByText('Results', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText(/Stats for TestExile/)).toBeVisible();
  await capture('search-results');

  await page.getByRole('menuitem', { name: 'Help' }).click();
  await capture('help');

  await page.goto(harnessUrl('unauthenticated'));
  await expect(page.getByRole('button', { name: 'Login with PoE' })).toBeVisible();
  await capture('login');

  await page.goto(harnessUrl('populated', '/login/character-select'));
  await expect(page.getByText('Pick a character to track')).toBeVisible();
  await capture('character-select');

  await page.goto(harnessUrl('populated', '/overlay'));
  await expect(page.getByText(/Tracking Unknown/)).toBeVisible();
  await page.evaluate(() => {
    window.__exileDiaryTest.emit('overlayMessage', {
      messages: [{ text: 'Fixture overlay message', type: 'info' }],
    });
  });
  await expect(page.getByText('Fixture overlay message')).toBeVisible();
  await capture('overlay');
});
