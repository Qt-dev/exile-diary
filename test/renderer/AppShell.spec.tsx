import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { appTheme, createAppRoutes } from '../../src/renderer/app';

jest.mock('../../src/renderer/electron.service', () => {
  const logger = {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
    scope: jest.fn(),
    silly: jest.fn(),
    verbose: jest.fn(),
    warn: jest.fn(),
  };
  logger.scope.mockImplementation(() => logger);

  return {
    electronService: {
      logger,
      getAllMapNames: jest.fn(),
      getAllPossibleMods: jest.fn(),
      getAppVersion: jest.fn(),
      getCharacters: jest.fn(),
      getDivinePrice: jest.fn(),
      getOAuthInfo: jest.fn(),
      getSettings: jest.fn(),
      isAuthenticated: jest.fn(),
      notifyFiltersUiUpdated: jest.fn(),
      on: jest.fn(),
      openExternal: jest.fn(),
      refreshGlobals: jest.fn(),
      refreshProfitPerHour: jest.fn(),
      requestNetWorthRefresh: jest.fn(),
    },
  };
});

jest.mock('../../src/helpers/ignoreManager', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    updateSettings: jest.fn(),
  },
}));

const { electronService: mockElectronService } = jest.requireMock(
  '../../src/renderer/electron.service'
);
const mockLogger = mockElectronService.logger;

const createRunStore = () =>
  ({
    runs: [],
    loadDetails: jest.fn(),
    loadRun: jest.fn(),
    getFullDuration: () => ({
      format: () => '0 days 00h 00m 00s',
    }),
    getPageCount: () => 1,
    getSortedRuns: () => [],
  } as any);

const renderApp = (initialEntry: string) => {
  const router = createMemoryRouter(
    createAppRoutes({
      runStore: createRunStore(),
      characterStore: {} as any,
      stashTabStore: {} as any,
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

  return router;
};

beforeEach(() => {
  jest.clearAllMocks();

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
  mockElectronService.on.mockImplementation(() => jest.fn());
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

  it('renders the main shell for authenticated launches', async () => {
    renderApp('/');

    expect(await screen.findByText(/Most Recent 0 Runs/i)).toBeInTheDocument();
    expect(await screen.findByText('v1.2.3')).toBeInTheDocument();
    expect(screen.getByText(/Exile Diary/i)).toBeInTheDocument();
    expect(mockElectronService.refreshProfitPerHour).toHaveBeenCalledTimes(1);
    expect(mockElectronService.requestNetWorthRefresh).toHaveBeenCalledTimes(1);
  });
});
