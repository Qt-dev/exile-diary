import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LogBox from '../../src/renderer/components/LogBox/LogBox';
import RunNavigation from '../../src/renderer/components/RunNavigation/RunNavigation';
import Run from '../../src/renderer/routes/Run';

jest.mock('../../src/renderer/electron.service', () => ({
  electronService: {
    on: jest.fn(() => jest.fn()),
    triggerLogAction: jest.fn(),
  },
}));

jest.mock('../../src/renderer/components/Pricing/Price', () => ({
  __esModule: true,
  default: ({ value }) => <span>{value}</span>,
}));

jest.mock('../../src/renderer/components/RunEvent/RunEventIcons', () => ({
  __esModule: true,
  default: () => <div>Run Event Icons</div>,
}));

jest.mock('../../src/renderer/components/RunEvent/RunEvent', () => ({
  __esModule: true,
  default: () => <div>Run Event</div>,
}));

jest.mock('../../src/renderer/components/LootTable/LootTable', () => ({
  __esModule: true,
  default: () => <div>Loot Table</div>,
}));

jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useLoaderData: jest.fn(),
  useParams: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
}));

const { useLoaderData, useParams } = jest.requireMock('react-router');
const { useNavigate } = jest.requireMock('react-router-dom');

const getConsoleMessages = (spy: jest.SpyInstance, matcher: string) =>
  spy.mock.calls
    .flat()
    .filter((value) => typeof value === 'string')
    .filter((value: string) => value.includes(matcher));

describe('renderer warning regressions', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    useNavigate.mockReturnValue(jest.fn());
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    jest.clearAllMocks();
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
                messages: [
                  { text: 'Alpha' },
                  { text: 'Beta', type: 'important' },
                ],
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
      getNextRun: jest.fn(() => null),
      getPreviousRun: jest.fn(() => null),
      getSortedRuns: jest.fn(() => [
        { runId: '1', name: 'Mesa', firstEvent: { format: () => '07/05/2026 12:00:00' } },
        { runId: '2', name: 'Dunes', firstEvent: { format: () => '07/05/2026 12:05:00' } },
      ]),
      reprocessRun: jest.fn(),
    };

    render(
      <MemoryRouter>
        <RunNavigation
          run={{ id: '1', runId: '1' }}
          store={store}
        />
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
            getNextRun: jest.fn(() => null),
            getPreviousRun: jest.fn(() => null),
            getSortedRuns: jest.fn(() => []),
            loadDetails: jest.fn(),
            reprocessRun: jest.fn(),
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Monsters fire 2 additional Projectiles')).toBeInTheDocument();
    expect(getConsoleMessages(consoleErrorSpy, 'validateDOMNesting')).toHaveLength(0);
  });
});
