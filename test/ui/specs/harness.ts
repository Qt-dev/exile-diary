import { expect, type Page, type TestInfo } from '@playwright/test';

export const fixedTime = new Date('2026-07-17T12:00:00.000Z');

type ErrorObservation = {
  pageErrors: string[];
  consoleErrors: string[];
  allowedConsoleErrors: RegExp[];
};

const errorObservations = new WeakMap<Page, ErrorObservation>();

export function observeUnexpectedErrors(page: Page) {
  const observation: ErrorObservation = {
    pageErrors: [],
    consoleErrors: [],
    allowedConsoleErrors: [],
  };
  errorObservations.set(page, observation);
  page.on('pageerror', (error) => observation.pageErrors.push(error.stack ?? error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') observation.consoleErrors.push(message.text());
  });
}

export function allowConsoleError(page: Page, pattern: RegExp) {
  errorObservations.get(page)?.allowedConsoleErrors.push(pattern);
}

export function assertNoUnexpectedErrors(page: Page, testInfo: TestInfo) {
  if (testInfo.status !== testInfo.expectedStatus) return;
  const observation = errorObservations.get(page);
  if (!observation) throw new Error('UI error observation was not installed for this page.');
  const unexpectedConsoleErrors = observation.consoleErrors.filter(
    (message) => !observation.allowedConsoleErrors.some((pattern) => pattern.test(message))
  );
  expect(observation.pageErrors, 'uncaught browser errors').toEqual([]);
  expect(unexpectedConsoleErrors, 'unexpected console errors').toEqual([]);
}

export async function preparePage(page: Page) {
  await page.clock.setFixedTime(fixedTime);
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent =
        '*, *::before, *::after { animation: none !important; transition: none !important; }';
      document.head.append(style);
    });
  });
}

export const harnessUrl = (scenario: string, route = '/') =>
  `?scenario=${scenario}#${route.startsWith('/') ? route : `/${route}`}`;

export async function getHarnessCalls(page: Page) {
  return page.evaluate(() => window.__exileDiaryTest.calls);
}
