import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { vi } from 'vitest';

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

  const listeners = new Map<string, () => void>();

  return {
    electronService: {
      logger,
      getOAuthInfo: vi.fn().mockResolvedValue({
        code_challenge: 'challenge',
        state: 'state',
      }),
      getCharacters: vi.fn().mockResolvedValue([
        {
          current: true,
          league: 'Settlers',
          name: 'Alice',
        },
      ]),
      isAuthenticated: vi.fn(),
      on: vi.fn((eventName: string, listener: () => void) => {
        listeners.set(eventName, listener);
        return () => listeners.delete(eventName);
      }),
      openExternal: vi.fn(),
      saveSettings: vi.fn(),
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
    loadDetails: vi.fn(),
    loadRun: vi.fn(),
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
    vi.clearAllMocks();
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

    expect(await screen.findByText(/Received Code, Fetching Oauth Token/i)).toBeInTheDocument();
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
    expect(await screen.findByText(/Received Code, Fetching Oauth Token/i)).toBeInTheDocument();

    await act(async () => {
      listeners.get('oauthAuthFailure')?.();
    });

    expect(await screen.findByText(/Something went wrong, please try again/i)).toBeInTheDocument();
    expect(screen.queryByText(/Received Code, Fetching Oauth Token/i)).not.toBeInTheDocument();
  });
});
