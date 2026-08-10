import React from 'react';
import { redirect, useRevalidator, useRouteError } from 'react-router-dom';
import { createTheme } from '@mui/material/styles';
import RunStore from './stores/runStore';
import CharacterStore from './stores/characterStore';
import StashTabStore from './stores/stashTabStore';
import SearchDataStore from './stores/searchDataStore';
import Root from './routes/root';
import Settings from './routes/Settings';
import RunList from './routes/RunList';
import Run from './routes/Run';
import Login from './routes/Login';
import Search from './routes/Search';
import Stats from './routes/Stats';
import StashTabs from './routes/StashTabs';
import CharacterSelect from './routes/CharacterSelect';
import LoginBox from './routes/LoginBox';
import Overlay from './routes/Overlay';
import Help from './routes/Help';
import Strategies from './routes/Strategies';
import Prices from './routes/Prices';
import { electronService } from './electron.service';

type AppRouteDependencies = {
  runStore: RunStore;
  characterStore: CharacterStore;
  stashTabStore: StashTabStore;
  createSearchDataStore?: () => SearchDataStore;
};

const logger = electronService.logger.scope('renderer/index');

export const createAppRoutes = ({
  runStore,
  characterStore,
  stashTabStore,
  createSearchDataStore = () => new SearchDataStore(),
}: AppRouteDependencies) => [
  {
    path: '/',
    element: <Root />,
    loader: async () => {
      const isAuthenticated = await electronService.isAuthenticated();
      if (!isAuthenticated) {
        logger.info('User is not authenticated, redirecting to the login page');
        return redirect('/login');
      }
      return {};
    },
    children: [
      {
        index: true,
        element: <RunList store={runStore} />,
      },
      {
        path: 'run/:runId',
        element: <Run store={runStore} />,
        loader: async ({ params }) => {
          const { runId } = params;
          if (!runId) throw new Error(`No run found with this id (${runId})`);
          await runStore.loadRun(runId);
          const run = runStore.runs.find((existingRun) => existingRun.runId === parseInt(runId));
          if (!run) {
            return redirect('/');
          }
          try {
            await runStore.loadDetails(run);
          } catch (error) {
            logger.error('Error loading run details', error);
          }
          return { run };
        },
        errorElement: <div>Error in Run parsing</div>,
      },
      {
        path: 'stash',
        element: <StashTabs store={stashTabStore} />,
        errorElement: <StashRouteError />,
        loader: async () => {
          if (!(await electronService.isAuthenticated())) {
            return redirect('/login');
          }
          await stashTabStore.ensureLoaded();
          return {};
        },
      },
      {
        path: 'search',
        element: <SearchRoute createSearchDataStore={createSearchDataStore} />,
        loader: async () => {
          const start = performance.now();
          const [settings, divinePrice, maps, possibleMods] = await Promise.all([
            electronService.getSettings().then((settings) => {
              logger.debug(`Settings loaded in ${performance.now() - start}ms`);
              return Promise.resolve(settings);
            }),
            electronService.getDivinePrice().then((divinePrice) => {
              logger.debug(`Divine price loaded in ${performance.now() - start}ms`);
              return Promise.resolve(divinePrice);
            }),
            electronService.getAllMapNames().then((maps) => {
              logger.debug(`Map names loaded in ${performance.now() - start}ms`);
              return Promise.resolve(maps);
            }),
            electronService.getAllPossibleMods().then((possibleMods) => {
              logger.debug(`Possible mods loaded in ${performance.now() - start}ms`);
              return Promise.resolve(possibleMods);
            }),
          ]);
          return { activeProfile: settings.activeProfile, divinePrice, maps, possibleMods };
        },
      },
      {
        path: 'stats',
        element: <Stats />,
        loader: async () => {
          const settings = await electronService.getSettings();
          return { activeProfile: settings.activeProfile };
        },
      },
      {
        path: 'strategies',
        element: <Strategies />,
      },
      {
        path: 'strategies/:strategyId',
        element: <Strategies />,
      },
      {
        path: 'prices',
        element: <Prices />,
      },
      {
        path: 'settings',
        element: (
          <Settings
            characterStore={characterStore}
            stashTabStore={stashTabStore}
            runStore={runStore}
          />
        ),
        loader: async () => {
          const settings = await electronService.getSettings();
          return { settings };
        },
      },
      {
        path: 'gear',
        element: <div>Gear</div>,
      },
      {
        path: 'help',
        element: <Help />,
      },
    ],
  },
  {
    path: '/login',
    element: <Login />,
    children: [
      {
        index: true,
        element: <LoginBox />,
        loader: async () => {
          const { code_challenge, state } = await electronService.getOAuthInfo();
          return { code_challenge, state };
        },
      },
      {
        path: 'character-select',
        element: <CharacterSelect />,
        loader: async () => {
          const characters = await electronService.getCharacters();
          return { characters };
        },
      },
    ],
  },
  {
    path: '/overlay',
    element: <Overlay store={runStore} />,
  },
];

function SearchRoute({ createSearchDataStore }: { createSearchDataStore: () => SearchDataStore }) {
  return <Search store={createSearchDataStore()} />;
}

function StashRouteError() {
  const error = useRouteError();
  const revalidator = useRevalidator();

  React.useEffect(() => {
    logger.error('Unable to load stash tabs', error);
  }, [error]);

  return (
    <div role="alert">
      <p>Unable to load stash tabs.</p>
      <button
        type="button"
        disabled={revalidator.state === 'loading'}
        onClick={() => revalidator.revalidate()}
      >
        {revalidator.state === 'loading' ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  );
}

export const appTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#8787fe',
    },
    secondary: {
      main: '#af5f1c',
    },
  },
  typography: {
    fontFamily: ['Fontin'].join(','),
    fontSize: 16,
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
  },
  components: {
    MuiDivider: {
      styleOverrides: {
        root: {
          borderWidth: '1px',
          margin: '3px 0',
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          fontSize: '24px',
          color: '#6666ff',
          fontFamily: 'FontinSmallCaps',
          '&:hover': {
            color: '#9999ff',
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '24px',
          fontFamily: 'FontinSmallCaps',
          padding: '0 5px',
          color: '#6666ff',
        },
      },
    },
  },
});
