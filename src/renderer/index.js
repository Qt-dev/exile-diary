import React from 'react';
import ReactDOM from 'react-dom/client';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import utc from 'dayjs/plugin/utc';
import calendar from 'dayjs/plugin/calendar';
import { createHashRouter, RouterProvider, redirect } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ipcRenderer } from 'electron';
import './index.css';
import reportWebVitals from './reportWebVitals';
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
import { electronService } from './electron.service';
const { logger } = electronService;
dayjs.extend(duration);
dayjs.extend(utc);
dayjs.extend(calendar);
const runStore = new RunStore();
const characterStore = new CharacterStore();
const stashTabStore = new StashTabStore();
characterStore.fetchCharacters();
stashTabStore.fetchStashTabs();

const router = createHashRouter([
  {
    path: '/',
    element: <Root />,
    loader: async () => {
      const isAuthenticated = await ipcRenderer.invoke('oauth:is-authenticated');
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
          const run = runStore.runs.find((run) => run.runId === runId);
          return { run };
        },
        errorElement: <div>Error in Run parsing</div>,
      },
      {
        path: 'stash',
        element: <StashTabs store={stashTabStore} />,
      },
      {
        path: 'search',
        element: <Search store={new SearchDataStore()} />,
        loader: async () => {
          const [settings, divinePrice, maps, possibleMods] = await Promise.all([
            ipcRenderer.invoke('get-settings'),
            ipcRenderer.invoke('get-divine-price'),
            ipcRenderer.invoke('get-all-map-names'),
            ipcRenderer.invoke('get-all-possible-mods'),
          ]);
          return { activeProfile: settings.activeProfile, divinePrice, maps, possibleMods };
        },
      },
      {
        path: 'stats',
        element: <Stats />,
        loader: async () => {
          const [settings, stats] = await Promise.all([
            ipcRenderer.invoke('get-settings'),
            ipcRenderer.invoke('get-all-stats'),
          ]);
          return { stats, activeProfile: settings.activeProfile };
        },
      },
      {
        path: 'settings',
        element: <Settings characterStore={characterStore} stashTabStore={stashTabStore} runStore={runStore} />,
        loader: async () => {
          const settings = await ipcRenderer.invoke('get-settings');
          return { settings };
        },
      },
      {
        path: 'gear',
        element: <div>Gear</div>,
      },
      {
        path: 'about',
        element: <div>About</div>,
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
          const { code_challenge, state } = await ipcRenderer.invoke('oauth:get-info');
          return { code_challenge, state };
        },
      },
      {
        path: 'character-select',
        element: <CharacterSelect />,
        loader: async () => {
          const characters = await ipcRenderer.invoke('get-characters');
          return { characters };
        },
      },
    ],
  },
  {
    path: '/overlay',
    element: <Overlay store={runStore} />,
  },
]);
const darkTheme = createTheme({
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

const documentRoot = document.getElementById('root');
if (documentRoot !== null) {
  const root = ReactDOM.createRoot(documentRoot);
  root.render(
    <React.StrictMode>
      <ThemeProvider theme={darkTheme}>
        <script>var global = global || window;</script>
        <RouterProvider router={router} />
      </ThemeProvider>
    </React.StrictMode>
  );
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
