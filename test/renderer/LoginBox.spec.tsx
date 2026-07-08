import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

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

  const listeners = new Map<string, () => void>();

  return {
    electronService: {
      logger,
      getOAuthInfo: jest.fn().mockResolvedValue({
        code_challenge: 'challenge',
        state: 'state',
      }),
      getCharacters: jest.fn().mockResolvedValue([
        {
          current: true,
          league: 'Settlers',
          name: 'Alice',
        },
      ]),
      isAuthenticated: jest.fn(),
      on: jest.fn((eventName: string, listener: () => void) => {
        listeners.set(eventName, listener);
        return () => listeners.delete(eventName);
      }),
      openExternal: jest.fn(),
      saveSettings: jest.fn(),
      __listeners: listeners,
    },
  };
});

import { appTheme, createAppRoutes } from '../../src/renderer/app';
import { electronService } from '../../src/renderer/electron.service';
import { ThemeProvider } from '@mui/material/styles';

const { __listeners: listeners, isAuthenticated } = electronService as typeof electronService & {
  __listeners: Map<string, () => void>;
};

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

const renderLoginRoute = () => {
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
      initialEntries: ['/login'],
    }
  );

  render(
    <ThemeProvider theme={appTheme}>
      <RouterProvider router={router} />
    </ThemeProvider>
  );

  return router;
};

describe('LoginBox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listeners.clear();
  });

  it('redirects to character select when auth is already complete', async () => {
    isAuthenticated.mockResolvedValue(true);

    const router = renderLoginRoute();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login/character-select');
    });
  });

  it('redirects to character select when oauth success arrives after mount', async () => {
    isAuthenticated.mockResolvedValue(false);

    const router = renderLoginRoute();
    await waitFor(() => {
      expect(listeners.has('oauthAuthSuccess')).toBe(true);
    });
    await act(async () => {
      listeners.get('oauthAuthSuccess')?.();
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login/character-select');
    });
  });

  it('shows token progress only after the renderer receives oauthReceivedCode', async () => {
    isAuthenticated.mockResolvedValue(false);

    renderLoginRoute();
    await waitFor(() => {
      expect(listeners.has('oauthReceivedCode')).toBe(true);
    });

    expect(screen.queryByText(/Received Code, Fetching Oauth Token/i)).not.toBeInTheDocument();

    await act(async () => {
      listeners.get('oauthReceivedCode')?.();
    });

    expect(
      await screen.findByText(/Received Code, Fetching Oauth Token/i)
    ).toBeInTheDocument();
  });

  it('shows an error state when the renderer receives oauthAuthFailure', async () => {
    isAuthenticated.mockResolvedValue(false);

    renderLoginRoute();
    await waitFor(() => {
      expect(listeners.has('oauthReceivedCode')).toBe(true);
      expect(listeners.has('oauthAuthFailure')).toBe(true);
    });
    await act(async () => {
      listeners.get('oauthReceivedCode')?.();
    });
    expect(
      await screen.findByText(/Received Code, Fetching Oauth Token/i)
    ).toBeInTheDocument();

    await act(async () => {
      listeners.get('oauthAuthFailure')?.();
    });

    expect(
      await screen.findByText(/Something went wrong, please try again/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Received Code, Fetching Oauth Token/i)).not.toBeInTheDocument();
  });
});
