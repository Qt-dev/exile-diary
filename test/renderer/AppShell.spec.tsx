import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { vi } from 'vitest';
import { appTheme, createAppRoutes } from '../../src/renderer/app';

vi.mock('../../src/renderer/electron.service', () => {
  const logger = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    scope: vi.fn(),
    silly: vi.fn(),
    verbose: vi.fn(),
    warn: vi.fn(),
  };
  logger.scope.mockImplementation(() => logger);

  return {
    electronService: {
      logger,
      getAllMapNames: vi.fn(),
      getAllPossibleMods: vi.fn(),
      getAppVersion: vi.fn(),
      getCharacters: vi.fn(),
      getDivinePrice: vi.fn(),
      getOAuthInfo: vi.fn(),
      getSettings: vi.fn(),
      isAuthenticated: vi.fn(),
      notifyFiltersUiUpdated: vi.fn(),
      on: vi.fn(),
      openExternal: vi.fn(),
      refreshGlobals: vi.fn(),
      refreshProfitPerHour: vi.fn(),
      requestNetWorthRefresh: vi.fn(),
      listStrategies: vi.fn().mockResolvedValue([]),
      setRunStrategies: vi.fn().mockResolvedValue([]),
      getPricesCatalog: vi.fn().mockResolvedValue([]),
      getItemPriceDetails: vi.fn().mockResolvedValue(null),
      addPriceOverride: vi.fn().mockResolvedValue({}),
      deletePriceOverride: vi.fn().mockResolvedValue(true),
      recalculatePrices: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock('../../src/helpers/ignoreManager', () => ({
  __esModule: true,
  default: {
    initialize: vi.fn(),
    updateSettings: vi.fn(),
  },
}));

const { electronService: mockElectronService } = await import(
  '../../src/renderer/electron.service'
);
const mockLogger = mockElectronService.logger;

const createRunStore = () =>
  ({
    runs: [],
    loadDetails: vi.fn(),
    loadRun: vi.fn(),
    getFullDuration: () => ({
      format: () => '0 days 00h 00m 00s',
    }),
    getPageCount: () => 1,
    getSortedRuns: () => [],
  } as any);

const createStashTabStore = () =>
  ({
    ensureLoaded: vi.fn().mockResolvedValue(undefined),
    flattenedStashTabs: [],
    itemStore: {
      getItemsForLootTable: () => [],
    },
    stashTabs: [],
    trackedStashTabs: [],
  } as any);

const renderApp = (initialEntry: string, stashTabStore = createStashTabStore()) => {
  const router = createMemoryRouter(
    createAppRoutes({
      runStore: createRunStore(),
      characterStore: { characters: [], fetchCharacters: vi.fn() } as any,
      stashTabStore,
    }),
    {
      future: {
        v7_startTransition: true,
      },
      initialEntries: [initialEntry],
    }
  );

  render(
    <ThemeProvider theme={appTheme}>
      <RouterProvider router={router} />
    </ThemeProvider>
  );

  return { router, stashTabStore };
};

beforeEach(() => {
  vi.clearAllMocks();

  mockElectronService.getAllMapNames.mockResolvedValue([]);
  mockElectronService.getAllPossibleMods.mockResolvedValue([]);
  mockElectronService.getAppVersion.mockReturnValue('1.2.3');
  mockElectronService.getCharacters.mockResolvedValue([]);
  mockElectronService.getDivinePrice.mockResolvedValue(0);
  mockElectronService.getOAuthInfo.mockResolvedValue({
    code_challenge: 'challenge',
    state: 'state',
  });
  mockElectronService.getSettings.mockResolvedValue({
    activeProfile: { valid: true },
    enableAutoscroll: true,
    filters: {
      filterPatterns: [],
      minimumValue: 0,
      perCategory: {},
    },
  });
  mockElectronService.isAuthenticated.mockResolvedValue(true);
  mockElectronService.on.mockImplementation(() => vi.fn());
  mockElectronService.refreshGlobals.mockResolvedValue({
    appLocale: 'en-US',
    appPath: 'mock-app',
    appVersion: '1.2.3',
  });
});

describe('renderer app shell smoke tests', () => {
  it('redirects unauthenticated launches to the login screen', async () => {
    mockElectronService.isAuthenticated.mockResolvedValue(false);

    renderApp('/');

    expect(await screen.findByRole('button', { name: /login with poe/i })).toBeInTheDocument();
    expect(mockElectronService.getOAuthInfo).toHaveBeenCalledTimes(1);
  });

  it('does not start stash loading before redirecting an unauthenticated stash route', async () => {
    mockElectronService.isAuthenticated.mockResolvedValue(false);
    const stashTabStore = createStashTabStore();

    renderApp('/stash', stashTabStore);

    expect(await screen.findByRole('button', { name: /login with poe/i })).toBeInTheDocument();
    expect(stashTabStore.ensureLoaded).not.toHaveBeenCalled();
  });

  it('renders the main shell for authenticated launches', async () => {
    renderApp('/');

    expect(await screen.findByText(/Most Recent 0 Runs/i)).toBeInTheDocument();
    expect(await screen.findByText('v1.2.3')).toBeInTheDocument();
    expect(screen.getByText(/Exile Diary/i)).toBeInTheDocument();
    expect(mockElectronService.refreshProfitPerHour).toHaveBeenCalledTimes(1);
    expect(mockElectronService.requestNetWorthRefresh).toHaveBeenCalledTimes(1);
  });

  it('loads stash tabs on demand for the stash route', async () => {
    const stashTabStore = createStashTabStore();

    renderApp('/stash', stashTabStore);

    await waitFor(() => expect(stashTabStore.ensureLoaded).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Stash Tabs')).toBeInTheDocument();
  });

  it('offers an in-route retry when stash loading fails', async () => {
    const stashTabStore = createStashTabStore();
    stashTabStore.ensureLoaded
      .mockRejectedValueOnce(new Error('stash request failed'))
      .mockResolvedValueOnce(undefined);

    renderApp('/stash', stashTabStore);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load stash tabs.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(stashTabStore.ensureLoaded).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Stash Tabs')).toBeInTheDocument();
  });

  it('loads stash tabs when the stash settings tab is selected', async () => {
    const stashTabStore = createStashTabStore();

    renderApp('/settings', stashTabStore);
    fireEvent.click(await screen.findByRole('tab', { name: 'Stashes' }));

    await waitFor(() => expect(stashTabStore.ensureLoaded).toHaveBeenCalledTimes(1));
  });

  it('offers a retry when stash loading fails from settings', async () => {
    const stashTabStore = createStashTabStore();
    stashTabStore.ensureLoaded
      .mockRejectedValueOnce(new Error('stash request failed'))
      .mockResolvedValueOnce(undefined);

    renderApp('/settings', stashTabStore);
    fireEvent.click(await screen.findByRole('tab', { name: 'Stashes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load stash tabs.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(stashTabStore.ensureLoaded).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText('Unable to load stash tabs.')).not.toBeInTheDocument()
    );
  });
});
