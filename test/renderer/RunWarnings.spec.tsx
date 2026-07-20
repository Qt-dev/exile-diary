import React from 'react';
import { render, screen } from '@testing-library/react';
import { useLoaderData as routerUseLoaderData, useParams as routerUseParams } from 'react-router';
import { MemoryRouter, useNavigate as routerUseNavigate } from 'react-router-dom';
import { vi } from 'vitest';
import LogBox from '../../src/renderer/components/LogBox/LogBox';
import RunNavigation from '../../src/renderer/components/RunNavigation/RunNavigation';
import Run from '../../src/renderer/routes/Run';

vi.mock('../../src/renderer/electron.service', () => ({
  electronService: {
    on: vi.fn(() => vi.fn()),
    triggerLogAction: vi.fn(),
  },
}));

vi.mock('../../src/renderer/components/Pricing/Price', () => ({
  __esModule: true,
  default: ({ value }) => <span>{value}</span>,
}));

vi.mock('../../src/renderer/components/RunEvent/RunEventIcons', () => ({
  __esModule: true,
  default: () => <div>Run Event Icons</div>,
}));

vi.mock('../../src/renderer/components/RunEvent/RunEvent', () => ({
  __esModule: true,
  default: () => <div>Run Event</div>,
}));

vi.mock('../../src/renderer/components/LootTable/LootTable', () => ({
  __esModule: true,
  default: () => <div>Loot Table</div>,
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useLoaderData: vi.fn(), useParams: vi.fn() };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: vi.fn() };
});

const useLoaderData = vi.mocked(routerUseLoaderData);
const useParams = vi.mocked(routerUseParams);
const useNavigate = vi.mocked(routerUseNavigate);

const getConsoleMessages = (spy: vi.SpyInstance, matcher: string) =>
  spy.mock.calls
    .flat()
    .filter((value) => typeof value === 'string')
    .filter((value: string) => value.includes(matcher));

describe('renderer warning regressions', () => {
  let consoleErrorSpy: vi.SpyInstance;
  let consoleWarnSpy: vi.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    useNavigate.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('renders log lines without key warnings', () => {
    render(
      <MemoryRouter>
        <LogBox
          enableAutoscroll={false}
          store={{
            logs: [
              {
                id: 'log-1',
                timestamp: { format: () => '2026-07-05 00:00:00' },
                messages: [{ text: 'Alpha' }, { text: 'Beta', type: 'important' }],
              },
            ],
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(
      getConsoleMessages(consoleErrorSpy, 'Each child in a list should have a unique "key" prop.')
    ).toHaveLength(0);
  });

  it('renders run navigation options without key warnings', () => {
    const store = {
      getNextRun: vi.fn(() => null),
      getPreviousRun: vi.fn(() => null),
      getSortedRuns: vi.fn(() => [
        { runId: '1', name: 'Mesa', firstEvent: { format: () => '07/05/2026 12:00:00' } },
        { runId: '2', name: 'Dunes', firstEvent: { format: () => '07/05/2026 12:05:00' } },
      ]),
      reprocessRun: vi.fn(),
    };

    render(
      <MemoryRouter>
        <RunNavigation run={{ id: '1', runId: '1' }} store={store} />
      </MemoryRouter>
    );

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(
      getConsoleMessages(consoleErrorSpy, 'Each child in a list should have a unique "key" prop.')
    ).toHaveLength(0);
  });

  it('renders run mods without invalid DOM nesting warnings', () => {
    const run = {
      duration: null,
      events: [],
      gained: 0,
      iiq: 20,
      iir: 35,
      initialxp: 1000,
      itemStore: {},
      kills: 12,
      league: 'Mirage',
      level: 83,
      mods: [{ mod: 'Monsters fire 2 additional Projectiles' }],
      name: 'Mesa',
      packSize: 15,
      runInfo: {},
      tier: 16,
      xp: 250,
      xpPerHour: 500000,
    };

    useParams.mockReturnValue({ runId: '216' });
    useLoaderData.mockReturnValue({ run });

    render(
      <MemoryRouter>
        <Run
          store={{
            getNextRun: vi.fn(() => null),
            getPreviousRun: vi.fn(() => null),
            getSortedRuns: vi.fn(() => []),
            loadDetails: vi.fn(),
            reprocessRun: vi.fn(),
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Monsters fire 2 additional Projectiles')).toBeInTheDocument();
    expect(getConsoleMessages(consoleErrorSpy, 'validateDOMNesting')).toHaveLength(0);
  });
});
